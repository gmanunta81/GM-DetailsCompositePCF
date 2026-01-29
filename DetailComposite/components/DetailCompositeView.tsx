import * as React from "react";

export interface DetailCompositeViewProps {
    value: string;
    isLoading: boolean;
    error?: string;
    onRefresh?: () => void;
}

export const DetailCompositeView: React.FC<DetailCompositeViewProps> = ({ 
    value, 
    isLoading, 
    error,
    onRefresh 
}) => {
    const [copied, setCopied] = React.useState(false);

    const onCopy = () => {
        navigator.clipboard.writeText(value || "")
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
                return undefined;
            })
            .catch(() => {
                // Clipboard might not be available in some contexts
            });
    };

    const handleRefresh = () => {
        if (onRefresh) {
            onRefresh();
        }
    };

    const rows = Math.min(10, Math.max(3, (value || "").split("\n").length));

    return (
        <div className="gm-detailComposite-root">
            {isLoading && <div className="gm-detailComposite-loading">Loading...</div>}
            {error && <div className="gm-detailComposite-error">{error}</div>}

            <textarea
                className="gm-detailComposite-textarea"
                readOnly
                value={value || ""}
                rows={rows}
            />

            <div className="gm-detailComposite-actions">
                <button type="button" onClick={handleRefresh} disabled={isLoading} title="Refresh">
                    🔄 Refresh
                </button>
                <button type="button" onClick={onCopy} disabled={!value}>
                    📋 Copy
                </button>
                {copied && <span className="gm-detailComposite-copied">Copied!</span>}
            </div>
        </div>
    );
};
