import type { UIMediaAttachment, UIMediaKind } from "@learnbuddy/shared";
export declare function inferMediaKind(media: {
    url?: string;
    name?: string;
}): UIMediaKind;
export declare function toMediaAttachment(media: {
    url?: string;
    name?: string;
    kind?: UIMediaKind;
}): UIMediaAttachment;
//# sourceMappingURL=media.d.ts.map