/** Keep the selected observation marked while the paper folds away. */
export function mountFieldNotes(paper: HTMLElement) {
  const onClick = (event: MouseEvent) => {
    const record = (event.target as Element).closest<HTMLElement>('.survey-observation');
    record?.classList.add('is-opening');
  };
  paper.addEventListener('click', onClick);
  return () => paper.removeEventListener('click', onClick);
}
