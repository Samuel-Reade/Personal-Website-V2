export function TagPills({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="tag-row">
      {tags.map((t) => (
        <span key={t} className="tag-pill">
          {t}
        </span>
      ))}
    </div>
  );
}
