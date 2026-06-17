import { ShieldCheckIcon } from "lucide-react";

interface EmptyStateProps {
    onCreate?: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-lg max-w-2xl mx-auto shadow-sm">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <ShieldCheckIcon className="w-8 h-8 text-primary" />
            </div>

            <h3 className="text-xl font-semibold mb-2 text-foreground">
                No credentials found
            </h3>

            <p className="text-muted-foreground text-center max-w-sm mb-8">
                Store and manage API keys (OpenAI, Anthropic, Gemini) securely to use them within your workflows.
            </p>

            {onCreate && (
                <button
                    onClick={onCreate}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 shadow-sm"
                >
                    Create First Credential
                </button>
            )}
        </div>
    );
}
