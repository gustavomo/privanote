#import <Foundation/Foundation.h>
#import <CoreAudio/CoreAudio.h>
#import <IOKit/IOKitLib.h>
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

// Check if any camera is active via IOKit (avoids CMIO which deadlocks under Electron)
BOOL isCameraActive(void) {
    io_iterator_t iterator;
    kern_return_t kr = IOServiceGetMatchingServices(
        kIOMainPortDefault,
        IOServiceMatching("AppleH13CameraInterface"),
        &iterator);

    // Fallback for older Macs
    if (kr != KERN_SUCCESS || !iterator) {
        kr = IOServiceGetMatchingServices(
            kIOMainPortDefault,
            IOServiceMatching("AppleCameraInterface"),
            &iterator);
    }
    if (kr != KERN_SUCCESS || !iterator) return NO;

    BOOL cameraActive = NO;
    io_service_t service;
    while ((service = IOIteratorNext(iterator)) != IO_OBJECT_NULL) {
        CFNumberRef deviceIsRunning = (CFNumberRef)IORegistryEntryCreateCFProperty(
            service, CFSTR("DeviceIsRunning"), kCFAllocatorDefault, 0);

        if (deviceIsRunning) {
            int running = 0;
            CFNumberGetValue(deviceIsRunning, kCFNumberIntType, &running);
            CFRelease(deviceIsRunning);
            if (running) {
                cameraActive = YES;
                IOObjectRelease(service);
                break;
            }
        }
        IOObjectRelease(service);
    }
    IOObjectRelease(iterator);
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
