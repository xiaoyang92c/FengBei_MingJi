import type { Room } from './content';

const dates: Record<Room['id'], string> = { worksite: '1950.06.15', archive: '1952.07.01', monument: '1954.07.01' };
const photoFocus: Record<Room['id'], string> = { worksite: '50% 50%', archive: '50% 60%', monument: '50% 68%' };

function cameraDate(value: string) {
  return `<time class="photo-date" datetime="${value.replaceAll('.', '-')}" aria-label="记事日期 ${value}，非照片拍摄日期">${value}</time>`;
}

/** Dates refer to the event depicted; image descriptions identify the artwork. */
export function memoryPhoto(room: Room, className: string, focus = photoFocus[room.id]) {
  return `<figure class="memory-photo ${className}"><div class="photo-print"><img src="${room.scene}" alt="${room.title}的艺术化场景，非历史照片" style="object-position:${focus}" decoding="async"><div class="photo-patina" aria-hidden="true"></div>${cameraDate(dates[room.id])}</div></figure>`;
}
