import { LeafSprig, ScrollIcon } from "./Ornaments";

/** Quest banner: stage title plus the current objective as subtitle. */
export default function StageBanner({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="fh-banner" aria-label="Ải hiện tại">
      <LeafSprig className="fh-banner-leaf is-left" />
      <LeafSprig flip className="fh-banner-leaf is-right" />
      <div className="fh-frame fh-banner-plate">
        <h1 className="fh-banner-title">{title}</h1>
        <p className="fh-banner-sub" aria-live="polite">
          <ScrollIcon size={18} />
          <span>{subtitle}</span>
        </p>
      </div>
    </section>
  );
}
