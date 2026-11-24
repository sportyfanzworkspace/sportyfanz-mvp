type StoryCardProps = {
  category: string;
  title: string;
  summary: string;
  time?: string;
};

export default function StoryCard({
  category,
  title,
  summary,
  time = "Just now",
}: StoryCardProps) {
  return (
    <article className="bg-[#101F2E] border border-white/10 rounded-2xl p-6 hover:border-[#70C172]/40 transition">

      <div className="flex justify-between gap-4">

        <span className="text-[#70C172] text-xs font-bold uppercase tracking-wider">
          {category}
        </span>

        <span className="text-gray-500 text-xs">
          {time}
        </span>

      </div>

      <h3 className="text-xl font-bold mt-4">
        {title}
      </h3>

      <p className="text-gray-400 mt-3 leading-6">
        {summary}
      </p>

      <button className="mt-5 text-[#70C172] text-sm font-bold">
        Read story →
      </button>

    </article>
  );
}