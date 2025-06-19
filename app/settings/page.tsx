"use client";

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/settings/history");
  return null;
}
