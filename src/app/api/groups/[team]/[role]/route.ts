import { groupMembers } from "@/lib/collaboration-store";

export async function GET(
  request: Request,
  context: { params: Promise<{ team: string; role: string }> },
) {
  const { team, role } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(team) || !["Editor", "Viewer"].includes(role))
    return new Response(null, { status: 404 });
  const members = await groupMembers(team, role);
  // Relative IRIs resolve to the requested group URI, including behind a reverse proxy.
  const lines = [
    "@prefix v: <http://www.w3.org/2006/vcard/ns#> .",
    "<#group> a v:Group .",
    ...members.map((id: string) => "<#group> v:hasMember <" + id + "> ."),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/turtle",
      "Cache-Control": "no-store",
      Vary: "Accept",
    },
  });
}
