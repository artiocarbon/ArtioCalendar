/* eslint-disable @next/next/no-head-element */
import BaseTable from "./BaseTable";
import EmailBodyLogo from "./EmailBodyLogo";
import EmailHead from "./EmailHead";
import EmailScheduledBodyHeaderContent from "./EmailScheduledBodyHeaderContent";
import EmailSchedulingBodyDivider from "./EmailSchedulingBodyDivider";
import type { BodyHeadType } from "./EmailSchedulingBodyHeader";
import EmailSchedulingBodyHeader from "./EmailSchedulingBodyHeader";
import RawHtml from "./RawHtml";
import Row from "./Row";

const Html = (props: { children: React.ReactNode }) => (
  <>
    <RawHtml html="<!doctype html>" />
    <html>{props.children}</html>
  </>
);

export const BaseEmailHtmlEnhanced = (props: {
  children: React.ReactNode;
  callToAction?: React.ReactNode;
  subject: string;
  title?: string;
  subtitle?: React.ReactNode | string;
  headerType?: BodyHeadType;
  hideLogo?: boolean;
}) => {
  return (
    <Html>
      <EmailHead title={props.subject} />
      <body style={{ 
        wordSpacing: "normal", 
        backgroundColor: "#F9FAFB",
        margin: 0,
        padding: 0,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
      }}>
        <div style={{ backgroundColor: "#F9FAFB", minHeight: "100vh" }}>
          <RawHtml
            html={`<!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->`}
          />
          <div style={{ margin: "0px auto", maxWidth: 600 }}>
            <Row align="center" border="0" style={{ width: "100%" }}>
              <td
                style={{
                  direction: "ltr",
                  fontSize: "0px",
                  padding: "0px",
                  paddingTop: "40px",
                  textAlign: "center",
                }}>
                <RawHtml
                  html={`<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr></tr></table><![endif]-->`}
                />
              </td>
            </Row>
          </div>
          <div
            style={{
              margin: "0px auto 24px auto",
              maxWidth: 600,
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              padding: "0px",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
            }}>
            {props.headerType && (
              <EmailSchedulingBodyHeader headerType={props.headerType} headStyles={{ border: 0 }} />
            )}
            {props.title && (
              <EmailScheduledBodyHeaderContent
                headStyles={{ border: 0 }}
                title={props.title}
                subtitle={props.subtitle}
              />
            )}
            {(props.headerType || props.title || props.subtitle) && (
              <EmailSchedulingBodyDivider headStyles={{ border: 0 }} />
            )}

            <RawHtml
              html={`<!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" className="" style="width:600px;" width="600" bgcolor="#FFFFFF" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->`}
            />
            <div
              style={{
                background: "#FFFFFF",
                backgroundColor: "#FFFFFF",
                margin: "0px auto",
                maxWidth: 600,
              }}>
              <Row
                align="center"
                border="0"
                style={{ background: "#FFFFFF", backgroundColor: "#FFFFFF", width: "100%" }}>
                <td
                  style={{
                    direction: "ltr",
                    fontSize: 0,
                    padding: 0,
                    textAlign: "center",
                  }}>
                  <RawHtml
                    html={`<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td className="" style="vertical-align:top;width:598px;" ><![endif]-->`}
                  />
                  <div
                    className="mj-column-per-100 mj-outlook-group-fix"
                    style={{
                      fontSize: 0,
                      textAlign: "left",
                      direction: "ltr",
                      display: "inline-block",
                      verticalAlign: "top",
                      width: "100%",
                    }}>
                    <Row border="0" style={{ verticalAlign: "top" }} width="100%">
                      <td align="left" style={{ 
                        fontSize: 0, 
                        padding: "20px 24px", 
                        wordBreak: "break-word",
                        backgroundColor: "#FFFFFF"
                      }}>
                        <div
                          style={{
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                            fontSize: 16,
                            fontWeight: 400,
                            lineHeight: 1.6,
                            textAlign: "left",
                            color: "#374151",
                          }}>
                          {props.children}
                        </div>
                      </td>
                    </Row>
                  </div>
                  <RawHtml html="<!--[if mso | IE]></td></tr></table><![endif]-->" />
                </td>
              </Row>
            </div>
            {props.callToAction && <EmailSchedulingBodyDivider headStyles={{ border: 0 }} />}
            <RawHtml
              html={`<!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" className="" style="width:600px;" width="600" bgcolor="#FFFFFF" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->`}
            />

            <div
              style={{
                background: "#FFFFFF",
                backgroundColor: "#FFFFFF",
                margin: "0px auto",
                maxWidth: 600,
              }}>
              <Row
                align="center"
                border="0"
                style={{ background: "#FFFFFF", backgroundColor: "#FFFFFF", width: "100%" }}>
                <td
                  style={{
                    direction: "ltr",
                    fontSize: 0,
                    padding: 0,
                    textAlign: "center",
                  }}>
                  <RawHtml
                    html={`<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td className="" style="vertical-align:top;width:598px;" ><![endif]-->`}
                  />
                  {props.callToAction && (
                    <div
                      className="mj-column-per-100 mj-outlook-group-fix"
                      style={{
                        fontSize: 0,
                        textAlign: "left",
                        direction: "ltr",
                        display: "inline-block",
                        verticalAlign: "top",
                        width: "100%",
                      }}>
                      <BaseTable border="0" style={{ verticalAlign: "top" }} width="100%">
                        <tbody>
                          <tr>
                            <td
                              align="center"
                              verticalAlign="middle"
                              style={{ 
                                fontSize: 0, 
                                padding: "24px 24px 16px 24px", 
                                wordBreak: "break-word",
                                backgroundColor: "#FFFFFF"
                              }}>
                              {props.callToAction}
                            </td>
                          </tr>
                          <tr>
                            <td
                              align="left"
                              style={{ 
                                fontSize: 0, 
                                padding: "0px 24px 24px 24px", 
                                wordBreak: "break-word",
                                backgroundColor: "#FFFFFF"
                              }}>
                              <div
                                style={{
                                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                                  fontSize: 13,
                                  lineHeight: 1.5,
                                  textAlign: "center",
                                  color: "#6B7280",
                                }}
                              />
                            </td>
                          </tr>
                        </tbody>
                      </BaseTable>
                    </div>
                  )}
                  <RawHtml html="<!--[if mso | IE]></td></tr></table><![endif]-->" />
                </td>
              </Row>
            </div>
          </div>
          {!Boolean(props.hideLogo) && <EmailBodyLogo />}
          <RawHtml html="<!--[if mso | IE]></td></tr></table><![endif]-->" />
        </div>
      </body>
    </Html>
  );
};
