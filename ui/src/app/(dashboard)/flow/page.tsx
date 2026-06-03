import { redirect } from "next/navigation";

/**
 * Cash-flow monthly breakdown has moved to the Spend page.
 */
export default function FlowPage() {
  redirect("/categories");
}
