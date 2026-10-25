/** Context action for whatever the hero is near: tap on mobile, E on keyboard. */
export default function InteractionPrompt({
  label,
  icon,
  onActivate,
}: {
  label: string | null;
  icon: string;
  onActivate: () => void;
}) {
  if (!label) {
    return <span className="adv-target">Bấm vào mặt đất để đi · lại gần để tương tác</span>;
  }
  return (
    <button type="button" className="gp-prompt" onClick={onActivate}>
      <kbd aria-hidden>E</kbd>
      <span aria-hidden>{icon}</span> {label}
    </button>
  );
}
