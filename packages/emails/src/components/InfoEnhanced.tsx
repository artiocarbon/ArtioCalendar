import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";

const Spacer = () => <p style={{ height: 12 }} />;

export const InfoEnhanced = (props: {
  label: string;
  description: React.ReactNode | undefined | null;
  extraInfo?: React.ReactNode;
  withSpacer?: boolean;
  lineThrough?: boolean;
  formatted?: boolean;
  isLabelHTML?: boolean;
}) => {
  if (!props.description || props.description === "") return null;

  const safeDescription = markdownToSafeHTML(props.description.toString()) || "";
  const safeLabel = markdownToSafeHTML(props.label.toString());

  const StyledHtmlContent = ({ htmlContent }: { htmlContent: string }) => {
    const css = "color: '#374151'; font-weight: 400; line-height: 1.6; margin: 0; font-size: 15px;";
    return (
      <div
        className="dark:text-darkgray-600 mt-3 text-sm text-gray-600 [&_a]:text-blue-500 [&_a]:underline [&_a]:hover:text-blue-600"
        // eslint-disable-next-line react/no-danger
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized via markdownToSafeHTML
        dangerouslySetInnerHTML={{
          __html: htmlContent
            .replaceAll("<p>", `<div style="${css}">`)
            .replaceAll("</p>", "</div>")
            .replaceAll("<li>", `<li style="${css} margin-left: 20px; margin-bottom: 4px;">`)
            .replaceAll("<ul>", `<ul style="margin: 8px 0; padding-left: 20px;">`)
            .replaceAll("</ul>", "</ul>"),
        }}
      />
    );
  };

  return (
    <>
      {props.withSpacer && <Spacer />}
      <div style={{ 
        backgroundColor: "#F9FAFB", 
        borderRadius: "8px", 
        padding: "16px", 
        marginBottom: "16px",
        border: "1px solid #E5E7EB"
      }}>
        <p style={{ 
          color: "#111827", 
          fontWeight: "600", 
          fontSize: "14px", 
          margin: "0 0 8px 0",
          textTransform: "uppercase",
          letterSpacing: "0.5px"
        }}>
          {props.isLabelHTML ? <StyledHtmlContent htmlContent={safeLabel} /> : props.label}
        </p>
        <div
          style={{
            color: "#374151",
            fontWeight: 400,
            lineHeight: "1.6",
            fontSize: "15px",
            whiteSpace: "pre-wrap",
            textDecoration: props.lineThrough ? "line-through" : undefined,
          }}>
          {props.formatted ? <StyledHtmlContent htmlContent={safeDescription} /> : props.description}
        </div>
        {props.extraInfo}
      </div>
    </>
  );
};
