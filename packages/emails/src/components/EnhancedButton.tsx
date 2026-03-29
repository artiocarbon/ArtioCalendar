import { BaseButton } from "./BaseButton";

export const EnhancedButton = (props: {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => {
  return (
    <BaseButton
      href={props.href}
      style={{
        backgroundColor: "#3B82F6",
        borderRadius: "8px",
        color: "#FFFFFF",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        fontSize: "16px",
        fontWeight: "600",
        letterSpacing: "0.5px",
        lineHeight: "24px",
        padding: "12px 24px",
        textDecoration: "none",
        textAlign: "center",
        border: "none",
        display: "inline-block",
        transition: "all 0.2s ease",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        ...props.style,
      }}
    >
      {props.children}
    </BaseButton>
  );
};
