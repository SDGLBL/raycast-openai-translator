import { Detail, List, Icon } from "@raycast/api";
import capitalize from "capitalize";
import { getLangName } from "../providers/lang";

export interface DiffViewProps {
  text: string;
  original: string;
  from: string;
  to: string;
  mode: string;
  showMetadata?: boolean;
  created_at?: string;
  ocrImg?: string;
  provider?: string;
}

export function DiffView(props: DiffViewProps) {
  const { text, original, from, to, mode, provider, created_at, showMetadata = true, ocrImg } = props;

  // Convert the AI-returned tags to Markdown format with emoji indicators
  // Use different formatting for each type of change
  const processedText = text
    .replace(/<del>(.*?)<\/del>/g, "❌ ~~$1~~ ") // Red X emoji + strikethrough for deletions
    .replace(/<add>(.*?)<\/add>/g, "✅ **$1** ") // Green check emoji + bold for additions
    .replace(/<change>(.*?)<\/change>/g, "🔄 *$1* ") // Blue arrows emoji + italic for changes

  // Count changes
  const deletionMatches = text.match(/<del>(.*?)<\/del>/g) || [];
  const additionMatches = text.match(/<add>(.*?)<\/add>/g) || [];
  const changeMatches = text.match(/<change>(.*?)<\/change>/g) || [];
  const changeCount = deletionMatches.length + additionMatches.length + changeMatches.length;

  // Count words and characters
  const wordCount = original.trim().split(/\s+/).filter(word => word.length > 0).length;
  const charCount = original.length;

  // Format according to screenshot style
  const displayStats = `${charCount} Characters • ${wordCount} Words • ${changeCount} Changes`;

  // Image markdown if there's an OCR image
  const imgMarkdown = ocrImg ? `\n\n![OCR Image](${ocrImg})` : "";

  // Create markdown with proper formatting
  const markdown = `${processedText}${imgMarkdown}`;

  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        showMetadata ? (
          <Detail.Metadata>
            <Detail.Metadata.Label
              title="Statistics"
              text={displayStats}
              icon={{ source: Icon.LineChart, tintColor: "#7DD3FC" }}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="Mode"
              text={capitalize(mode)}
              icon={{ source: Icon.Document, tintColor: "#1B99FF" }}
            />
            <Detail.Metadata.Label
              title="Language"
              text={getLangName(from)}
              icon={{ source: Icon.Globe, tintColor: "#00B96B" }}
            />
            {created_at && (
              <Detail.Metadata.Label
                title="Created"
                text={new Date(created_at).toLocaleString()}
                icon={{ source: Icon.Clock, tintColor: "#BF5AF2" }}
              />
            )}
            {provider && (
              <Detail.Metadata.Label
                title="Provider"
                text={provider}
                icon={{ source: Icon.Cog, tintColor: "#FF9F0A" }}
              />
            )}
            <Detail.Metadata.Separator />

            {/* Extract and display individual changes */}
            {deletionMatches.length > 0 && (
              <Detail.Metadata.TagList title="Deletions">
                {deletionMatches.map((match, index) => {
                  const deletion = match.replace(/<del>(.*?)<\/del>/g, "$1");
                  return (
                    <Detail.Metadata.TagList.Item
                      key={`del-${index}`}
                      text={deletion}
                      color={{ light: "#FF5252", dark: "#FF5252" }}
                      icon={Icon.XMarkCircle}
                    />
                  );
                })}
              </Detail.Metadata.TagList>
            )}

            {additionMatches.length > 0 && (
              <Detail.Metadata.TagList title="Additions">
                {additionMatches.map((match, index) => {
                  const addition = match.replace(/<add>(.*?)<\/add>/g, "$1");
                  return (
                    <Detail.Metadata.TagList.Item
                      key={`add-${index}`}
                      text={addition}
                      color={{ light: "#4CAF50", dark: "#4CAF50" }}
                      icon={Icon.CheckCircle}
                    />
                  );
                })}
              </Detail.Metadata.TagList>
            )}

            {changeMatches.length > 0 && (
              <Detail.Metadata.TagList title="Modified Words">
                {changeMatches.map((match, index) => {
                  const change = match.replace(/<change>(.*?)<\/change>/g, "$1");
                  return (
                    <Detail.Metadata.TagList.Item
                      key={`change-${index}`}
                      text={change}
                      color={{ light: "#2196F3", dark: "#2196F3" }}
                      icon={Icon.ArrowClockwise}
                    />
                  );
                })}
              </Detail.Metadata.TagList>
            )}

            <Detail.Metadata.Separator />
            <Detail.Metadata.TagList title="Original Text">
              <Detail.Metadata.TagList.Item text={original} />
            </Detail.Metadata.TagList>
          </Detail.Metadata>
        ) : null
      }
    />
  );
}
