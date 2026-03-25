import type { PageProps } from "app/_types";
import { redirect } from "next/navigation";

export default async function IntroPage({ params }: PageProps) {
  const resolvedParams = await params;
  const userParam = resolvedParams.user;

  if (!userParam) {
    return redirect("/");
  }

  const user = Array.isArray(userParam) ? userParam[0] : userParam;
  const decodedUser = decodeURIComponent(user);

  // For now, "intro" is just the public user profile page.
  return redirect(`/${decodedUser}`);
}
