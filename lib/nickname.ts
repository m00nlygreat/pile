const colors = [
  '푸른',
  '붉은',
  '초록',
  '노란',
  '보랏',
  '하얀',
  '검은',
  '은빛',
  '금빛',
  '맑은'
];

const animals = [
  '고래',
  '여우',
  '부엉이',
  '노루',
  '판다',
  '매',
  '수달',
  '너구리',
  '표범',
  '거북'
];

export function generateNickname(seed: number) {
  const color = colors[seed % colors.length];
  const animal = animals[seed % animals.length];
  const suffix = Math.floor(10 + (seed % 90));
  return `${color}${animal}-${suffix}`;
}
