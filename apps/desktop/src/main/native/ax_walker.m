#import <Foundation/Foundation.h>
#import <ApplicationServices/ApplicationServices.h>

// Escape a string for JSON output
NSString *escapeJSON(NSString *str) {
    NSMutableString *escaped = [NSMutableString string];
    NSUInteger len = [str length];
    for (NSUInteger i = 0; i < len; i++) {
        unichar c = [str characterAtIndex:i];
        switch (c) {
            case '"':  [escaped appendString:@"\\\""]; break;
            case '\\': [escaped appendString:@"\\\\"]; break;
            case '\n': [escaped appendString:@"\\n"]; break;
            case '\r': [escaped appendString:@"\\r"]; break;
            case '\t': [escaped appendString:@"\\t"]; break;
            default:   [escaped appendFormat:@"%C", c]; break;
        }
    }
    return escaped;
}

// Recursively extract text from AX tree
void extractTexts(AXUIElementRef element, int depth, int maxDepth, NSMutableArray *texts) {
    if (depth >= maxDepth) return;

    // Get the role to skip non-content elements
    CFTypeRef roleRef = NULL;
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute, &roleRef);
    NSString *role = (__bridge_transfer NSString *)roleRef;
    if (!role) role = @"";

    // Skip menu bars, menu items, and window control buttons
    NSSet *skipRoles = [NSSet setWithObjects:@"AXMenuBar", @"AXMenu", @"AXMenuItem", @"AXMenuBarItem", nil];
    if ([skipRoles containsObject:role]) return;

    // Extract text value
    CFTypeRef valueRef = NULL;
    AXUIElementCopyAttributeValue(element, kAXValueAttribute, &valueRef);
    if (valueRef) {
        NSString *value = (__bridge_transfer NSString *)valueRef;
        if ([value isKindOfClass:[NSString class]]) {
            NSString *trimmed = [value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
            if ([trimmed length] > 0) {
                [texts addObject:trimmed];
            }
        }
    }

    // Extract title (for buttons, labels, etc.)
    CFTypeRef titleRef = NULL;
    AXUIElementCopyAttributeValue(element, kAXTitleAttribute, &titleRef);
    if (titleRef) {
        NSString *title = (__bridge_transfer NSString *)titleRef;
        if ([title isKindOfClass:[NSString class]]) {
            NSString *trimmed = [title stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
            if ([trimmed length] > 0) {
                // Skip generic window chrome titles
                NSSet *skipTitles = [NSSet setWithObjects:@"Close", @"Minimize", @"Zoom", @"Full Screen", nil];
                if (![skipTitles containsObject:trimmed]) {
                    [texts addObject:trimmed];
                }
            }
        }
    }

    // Extract description
    CFTypeRef descRef = NULL;
    AXUIElementCopyAttributeValue(element, kAXDescriptionAttribute, &descRef);
    if (descRef) {
        NSString *desc = (__bridge_transfer NSString *)descRef;
        if ([desc isKindOfClass:[NSString class]]) {
            NSString *trimmed = [desc stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
            if ([trimmed length] > 0) {
                [texts addObject:trimmed];
            }
        }
    }

    // Recurse into children
    CFTypeRef childrenRef = NULL;
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute, &childrenRef);
    if (childrenRef) {
        NSArray *children = (__bridge_transfer NSArray *)childrenRef;
        if ([children isKindOfClass:[NSArray class]]) {
            for (id child in children) {
                AXUIElementRef childElement = (__bridge AXUIElementRef)child;
                extractTexts(childElement, depth + 1, maxDepth, texts);
            }
        }
    }
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc < 2) {
            printf("{\"texts\":[],\"elementCount\":0,\"success\":false,\"error\":\"Usage: ax_walker <pid>\"}\n");
            return 1;
        }

        pid_t pid = (pid_t)atoi(argv[1]);
        if (pid <= 0) {
            printf("{\"texts\":[],\"elementCount\":0,\"success\":false,\"error\":\"Invalid PID\"}\n");
            return 1;
        }

        AXUIElementRef appElement = AXUIElementCreateApplication(pid);
        NSMutableArray *texts = [NSMutableArray array];
        extractTexts(appElement, 0, 15, texts);
        CFRelease(appElement);

        // Deduplicate while preserving order
        NSMutableOrderedSet *seen = [NSMutableOrderedSet orderedSet];
        for (NSString *text in texts) {
            [seen addObject:text];
        }
        NSArray *uniqueTexts = [seen array];

        // Build JSON output
        NSMutableString *jsonTexts = [NSMutableString stringWithString:@"["];
        for (NSUInteger i = 0; i < [uniqueTexts count]; i++) {
            if (i > 0) [jsonTexts appendString:@","];
            [jsonTexts appendFormat:@"\"%@\"", escapeJSON(uniqueTexts[i])];
        }
        [jsonTexts appendString:@"]"];

        BOOL success = [uniqueTexts count] > 0;
        printf("{\"texts\":%s,\"elementCount\":%lu,\"success\":%s}\n",
               [jsonTexts UTF8String],
               (unsigned long)[uniqueTexts count],
               success ? "true" : "false");

        return 0;
    }
}
