interface FileReferenceChipProps {
    path: string;
    tooltipPath?: string;
    display?: "name" | "path";
    active?: boolean;
    className?: string;
    textClassName?: string;
    testId?: string;
}
export declare function FileReferenceChip({ path, tooltipPath, display, active, className, textClassName, testId, }: FileReferenceChipProps): import("react/jsx-runtime").JSX.Element;
export declare function isLikelyFilePath(value: string): boolean;
export {};
//# sourceMappingURL=FileReferenceChip.d.ts.map