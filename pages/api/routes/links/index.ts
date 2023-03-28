import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "pages/api/auth/[...nextauth]";
import getLinks from "@/lib/api/controllers/links/getLinks";
import postLink from "@/lib/api/controllers/links/postLink";
import deleteLink from "@/lib/api/controllers/links/deleteLink";

export default async function (req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ response: "You must be logged in." });
  }

  if (req.method === "GET") {
    const links = await getLinks(session.user.id);
    return res.status(links.status).json({ response: links.response });
  } else if (req.method === "POST") {
    const newlink = await postLink(req.body, session.user.id);
    return res.status(newlink.status).json({
      response: newlink.response,
    });
  } else if (req.method === "DELETE") {
    const deleted = await deleteLink(req.body, session.user.id);
    return res.status(deleted.status).json({
      response: deleted.response,
    });
  }
}