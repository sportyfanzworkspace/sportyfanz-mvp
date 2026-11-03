
import HomePage from "./home-page-client";
import { getCachedNews } from "@/lib/news-feed";

export const runtime = "nodejs";

type HomePageSearchParams = {
  welcome?: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<HomePageSearchParams>;
}) {
  const params = await searchParams;
  const initialWelcome = params.welcome === "1";

  let initialNews = [];

  try {
    const data = await getCachedNews();

    initialNews = (data.stories ?? [])
      .filter((story) => story.image && story.link && story.title)
      .slice(0, 2);
  } catch (error) {
    console.error("Unable to load initial homepage news:", error);
  }

  return (
    <HomePage
      initialNews={initialNews}
      initialWelcome={initialWelcome}
    />
  );
}
