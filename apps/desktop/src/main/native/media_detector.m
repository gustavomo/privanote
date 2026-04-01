#import <Foundation/Foundation.h>
#import <CoreAudio/CoreAudio.h>
#import <CoreMediaIO/CMIOHardware.h>
#import <AppKit/AppKit.h>

// Known call app bundle IDs
static NSArray *knownCallAppBundleIds(void) {
    return @[
        @"us.zoom.xos",
        @"com.microsoft.teams",
        @"com.microsoft.teams2",
        @"com.tinyspeck.slackmacgap",
        @"com.skype.skype",
        @"com.apple.FaceTime",
        @"com.google.Chrome",
        @"com.brave.Browser",
        @"com.discord",
        @"com.cisco.webexmeetingsapp"
    ];
}

// Check if any audio input device is running (mic active)
BOOL isMicrophoneActive(void) {
    AudioObjectPropertyAddress devicesAddr = {
        kAudioHardwarePropertyDevices,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain
    };

    UInt32 dataSize = 0;
    OSStatus status = AudioObjectGetPropertyDataSize(
        kAudioObjectSystemObject, &devicesAddr, 0, NULL, &dataSize);
    if (status != noErr || dataSize == 0) return NO;

    UInt32 deviceCount = dataSize / sizeof(AudioObjectID);
    AudioObjectID *devices = (AudioObjectID *)malloc(dataSize);
    status = AudioObjectGetPropertyData(
        kAudioObjectSystemObject, &devicesAddr, 0, NULL, &dataSize, devices);
    if (status != noErr) { free(devices); return NO; }

    BOOL micActive = NO;
    for (UInt32 i = 0; i < deviceCount; i++) {
        // Check if device has input streams
        AudioObjectPropertyAddress streamsAddr = {
            kAudioDevicePropertyStreams,
            kAudioObjectPropertyScopeInput,
            kAudioObjectPropertyElementMain
        };
        UInt32 streamsSize = 0;
        status = AudioObjectGetPropertyDataSize(devices[i], &streamsAddr, 0, NULL, &streamsSize);
        if (status != noErr || streamsSize == 0) continue; // No input streams

        // Check if device is running somewhere
        AudioObjectPropertyAddress runningAddr = {
            kAudioDevicePropertyDeviceIsRunningSomewhere,
            kAudioObjectPropertyScopeInput,
            kAudioObjectPropertyElementMain
        };
        UInt32 isRunning = 0;
        UInt32 runningSize = sizeof(isRunning);
        status = AudioObjectGetPropertyData(devices[i], &runningAddr, 0, NULL, &runningSize, &isRunning);
        if (status == noErr && isRunning) {
            micActive = YES;
            break;
        }
    }

    free(devices);
    return micActive;
}

// Check if any camera device is running
BOOL isCameraActive(void) {
    // Allow screen capture devices to be enumerated
    UInt32 allow = 1;
    CMIOObjectPropertyAddress allowAddr = {
        kCMIOHardwarePropertyAllowScreenCaptureDevices,
        kCMIOObjectPropertyScopeGlobal,
        kCMIOObjectPropertyElementMain
    };
    CMIOObjectSetPropertyData(
        kCMIOObjectSystemObject, &allowAddr, 0, NULL, sizeof(allow), &allow);

    // Get all CMIO devices
    CMIOObjectPropertyAddress devicesAddr = {
        kCMIOHardwarePropertyDevices,
        kCMIOObjectPropertyScopeGlobal,
        kCMIOObjectPropertyElementMain
    };

    UInt32 dataSize = 0;
    OSStatus status = CMIOObjectGetPropertyDataSize(
        kCMIOObjectSystemObject, &devicesAddr, 0, NULL, &dataSize);
    if (status != noErr || dataSize == 0) return NO;

    UInt32 deviceCount = dataSize / sizeof(CMIOObjectID);
    CMIOObjectID *devices = (CMIOObjectID *)malloc(dataSize);
    UInt32 dataUsed = 0;
    status = CMIOObjectGetPropertyData(
        kCMIOObjectSystemObject, &devicesAddr, 0, NULL, dataSize, &dataUsed, devices);
    if (status != noErr) { free(devices); return NO; }

    BOOL cameraActive = NO;
    for (UInt32 i = 0; i < deviceCount; i++) {
        CMIOObjectPropertyAddress runningAddr = {
            kCMIODevicePropertyDeviceIsRunningSomewhere,
            kCMIOObjectPropertyScopeWildcard,
            kCMIOObjectPropertyElementMain
        };
        UInt32 isRunning = 0;
        UInt32 runningSize = sizeof(isRunning);
        UInt32 runningUsed = 0;
        status = CMIOObjectGetPropertyData(devices[i], &runningAddr, 0, NULL, runningSize, &runningUsed, &isRunning);
        if (status == noErr && isRunning) {
            cameraActive = YES;
            break;
        }
    }

    free(devices);
    return cameraActive;
}

// Find which known call app is running (excluding selfPID)
NSDictionary *findActiveCallApp(pid_t selfPID) {
    NSArray *bundleIds = knownCallAppBundleIds();
    NSArray<NSRunningApplication *> *apps = [[NSWorkspace sharedWorkspace] runningApplications];

    for (NSRunningApplication *app in apps) {
        if (app.processIdentifier == selfPID) continue;

        NSString *bundleId = app.bundleIdentifier;
        if (!bundleId) continue;

        // Skip Privanote's own processes
        if ([bundleId containsString:@"com.privanote"]) continue;

        NSString *name = app.localizedName;
        if ([name isEqualToString:@"Electron"]) continue;

        if ([bundleIds containsObject:bundleId]) {
            return @{
                @"appName": name ?: @"Unknown",
                @"bundleId": bundleId,
                @"pid": @(app.processIdentifier)
            };
        }
    }

    return nil;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        pid_t selfPID = 0;
        if (argc >= 2) {
            selfPID = (pid_t)atoi(argv[1]);
        }

        BOOL micActive = isMicrophoneActive();
        BOOL cameraActive = isCameraActive();

        if (micActive || cameraActive) {
            NSDictionary *callApp = findActiveCallApp(selfPID);
            if (callApp) {
                printf("{\"micActive\":%s,\"cameraActive\":%s,\"appName\":\"%s\",\"bundleId\":\"%s\",\"pid\":%d}\n",
                       micActive ? "true" : "false",
                       cameraActive ? "true" : "false",
                       [[callApp objectForKey:@"appName"] UTF8String],
                       [[callApp objectForKey:@"bundleId"] UTF8String],
                       [[callApp objectForKey:@"pid"] intValue]);
            } else {
                printf("{\"micActive\":%s,\"cameraActive\":%s,\"appName\":\"Unknown\",\"bundleId\":\"\",\"pid\":0}\n",
                       micActive ? "true" : "false",
                       cameraActive ? "true" : "false");
            }
        } else {
            printf("{\"micActive\":false,\"cameraActive\":false}\n");
        }

        return 0;
    }
}
