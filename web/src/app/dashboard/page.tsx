"use client";

// Dashboard = just the video workspace: the VideoPane (player + subtitles + dub)
// and ONE collapsible sidebar (YTsidebar) with all five tabs. Everything else —
// selection, the processing pipeline and user data — is owned by the providers
// mounted in the root layout, so this page stays thin.

import Header from "@/_comps/Header";
import SearchBox from "@/_comps/SearchBox";
import UserDashboard from "@/_comps/dashboard/UserDashboard";

export default function Page() {
  return (
    <>
      <Header onSignIn={() => {}} />
      <SearchBox onSubmit={() => {}} UI="top" />
      <UserDashboard />
    </>
  );
}
