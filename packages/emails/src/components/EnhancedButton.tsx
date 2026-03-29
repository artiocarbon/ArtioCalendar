import { CallToAction } from "./CallToAction";

export const EnhancedButton = (props: {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => {
  return (
    <div style={props.style}>
      <CallToAction 
        href={props.href}
        label={props.children as string}
      />
    </div>
  );
};
