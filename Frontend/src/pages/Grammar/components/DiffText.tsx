/** Renders a difflib-style diff (`" x"` unchanged / `"+x"` added / `"-x"` removed per entry) with added/removed chars highlighted. */
export default function DiffText({ diffs }: { diffs: string[] }) {
  return (
    <>
      {diffs.map((diff, index) => {
        const op = diff[0];
        const char = diff[2];
        if (op === " ") return <span key={index}>{char}</span>;
        if (op === "+")
          return (
            <span key={index} className="text-teal-600 dark:text-teal-400 font-medium">
              {char}
            </span>
          );
        if (op === "-")
          return (
            <span key={index} className="line-through text-rose-500 dark:text-rose-400">
              {char}
            </span>
          );
        return null;
      })}
    </>
  );
}
