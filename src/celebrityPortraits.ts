import type { MediaAsset } from './domain';

export type MockProfileGender = 'WOMAN' | 'MAN';

/**
 * Publicly released portrait photography used only as visual mock data.
 * Profile names, ages, jobs, interests, and biographies remain fictional and
 * do not describe or impersonate the pictured celebrity.
 */
export interface CelebrityPortrait {
  readonly id: string;
  readonly celebrityName: string;
  readonly gender: MockProfileGender;
  readonly url: string;
  readonly width: 600;
  readonly height: 900;
}

const portrait = (
  id: string,
  celebrityName: string,
  gender: MockProfileGender,
  imagePath: string,
): CelebrityPortrait => ({
  id,
  celebrityName,
  gender,
  url: `https://image.tmdb.org/t/p/w600_and_h900_bestv2/${imagePath}`,
  width: 600,
  height: 900,
});

const WOMAN_CELEBRITY_PORTRAITS = [
  portrait('zhao_lusi', '赵露思', 'WOMAN', 'y82wmaDqTdXqvtasb4kxAIuT44U.jpg'),
  portrait('yang_zi', '杨紫', 'WOMAN', 'rix91XOQ3xiNSLoWHXFnuklRxgi.jpg'),
  portrait('dilraba_dilmurat', '迪丽热巴', 'WOMAN', 'vrgYSOBnySesIUS5XvyjSYz7qZ0.jpg'),
  portrait('zhao_liying', '赵丽颖', 'WOMAN', '1LSOJSwzRyO6d87sE0DZZnwL1jO.jpg'),
  portrait('yang_mi', '杨幂', 'WOMAN', 'x5EsYXKH2Kdc6QPYhoaSoAsnsjw.jpg'),
  portrait('liu_shishi', '刘诗诗', 'WOMAN', 'yPyMTroHKKpK2g24o7920erAa3L.jpg'),
  portrait('ni_ni', '倪妮', 'WOMAN', '9htVCCREXhXxxa1V5ev386wjD1S.jpg'),
  portrait('zhou_ye', '周也', 'WOMAN', 'alqSqe6RmhIkZ6eUcjDXS6QTJhS.jpg'),
  portrait('zhang_jingyi', '张婧仪', 'WOMAN', 'yWGNWknWP8pJmfLr3o0AMz5QTzi.jpg'),
  portrait('wang_churan', '王楚然', 'WOMAN', 'trE6PMD0vgcuvEMog7gRpnWr8TQ.jpg'),
  portrait('yu_shuxin', '虞书欣', 'WOMAN', 'xQ2Bur9AEy0IX3qHMvLbr7tmTyD.jpg'),
  portrait('bai_lu', '白鹿', 'WOMAN', '8vQfjg60RUkbIodw6FgrLteHBo7.jpg'),
  portrait('liu_yifei', '刘亦菲', 'WOMAN', 'cL6JccAYqiZQEAIEFObEUC9LTt7.jpg'),
  portrait('zhou_dongyu', '周冬雨', 'WOMAN', 'vD2vVvIIx8ygzkhUQZJLkvYT1jr.jpg'),
  portrait('zhang_ziyi', '章子怡', 'WOMAN', 'AeM8e72StFIoEe7wcPQgnQsHtyf.jpg'),
  portrait('song_yi', '宋轶', 'WOMAN', 'pwYD4s1grpK2YjT6lkBWLL38wTH.jpg'),
  portrait('jin_chen', '金晨', 'WOMAN', 'wVsQG1eNFFmCI3HTaje4Rox8SFA.jpg'),
  portrait('li_qin', '李沁', 'WOMAN', 'thak4pt7jCPbl2xx5HnFhkEE0Tu.jpg'),
  portrait('tan_songyun', '谭松韵', 'WOMAN', '4HJFzfLjIAmqLakN29AQisFyjSU.jpg'),
  portrait('guan_xiaotong', '关晓彤', 'WOMAN', 'b48jZXCEzBLMHZoTuAHLMXayWqE.jpg'),
  portrait('zhang_zifeng', '张子枫', 'WOMAN', '3S8yEnTVqH8T3bTVf9FmtXxWcu2.jpg'),
  portrait('wen_qi', '文淇', 'WOMAN', '5sV0c3iCnLhepzfR1OA2dqAtaEr.jpg'),
  portrait('zhang_xueying', '张雪迎', 'WOMAN', 'ccpdJNXgcDG0nrrYgEqP9fllrVY.jpg'),
  portrait('song_zuer', '宋祖儿', 'WOMAN', 'aB1MfYz5LDZmfULDnqGjRgsg25Z.jpg'),
  portrait('li_gengxi', '李庚希', 'WOMAN', 'ztPbA2F07VCFHSAaHMTID49klTH.jpg'),
] as const;

const MAN_CELEBRITY_PORTRAITS = [
  portrait('xiao_zhan', '肖战', 'MAN', '468n73j2sSJIbfZvsIZvDpvUaS8.jpg'),
  portrait('wang_yibo', '王一博', 'MAN', '5akr656RvJX8hl1pa1qZckfiQeF.jpg'),
  portrait('yi_yangqianxi', '易烊千玺', 'MAN', '2aTKxf2HZqI91Obu0ocfwoE2Pb5.jpg'),
  portrait('wang_hedi', '王鹤棣', 'MAN', '7YITQE9XpeaOIWJsV6TTzaPilSW.jpg'),
  portrait('yang_yang', '杨洋', 'MAN', 'lEBuoN1XItYMLpgsMmtORrEx1BY.jpg'),
  portrait('tan_jianci', '檀健次', 'MAN', 'wZVw3agRZwqTKeOr4q7wkMET9hJ.jpg'),
  portrait('zhang_linghe', '张凌赫', 'MAN', '3Jv2t7hyaHVUYOO85ELwz3Bxe4X.jpg'),
  portrait('chen_zheyuan', '陈哲远', 'MAN', 'uOEqq05ghCxZXn7w92nriHu0T5A.jpg'),
  portrait('wu_lei', '吴磊', 'MAN', 'z1Aw5fyYAND8EOthud6gbIV22rk.jpg'),
  portrait('bai_jingting', '白敬亭', 'MAN', 'b3kmtLVQtgywB1QKWYHoNLsdqSO.jpg'),
  portrait('cheng_yi', '成毅', 'MAN', 'fTgfOhV3tnfMpYLXh3l3QEWcLjI.jpg'),
  portrait('gong_jun', '龚俊', 'MAN', '4KInYhdUoeV7Pd6eMQGcrhQVOWC.jpg'),
  portrait('zhang_wanyi', '张晚意', 'MAN', 'wG7GZ5XRUgwTMiAQS1gvgJEABKl.jpg'),
  portrait('chen_xingxu', '陈星旭', 'MAN', 'coASvXYBdg4xTrW7W46ZQmfkwxk.jpg'),
  portrait('liu_haoran', '刘昊然', 'MAN', '3m6zJtGo0oQSxvmUOn0urhEY7fg.jpg'),
  portrait('zhang_xincheng', '张新成', 'MAN', 'mpCVPsEvnMUkmMd1IN1xsBJpk7r.jpg'),
  portrait('zeng_shunxi', '曾舜晞', 'MAN', 'hfMNwzZv7SxJ6d8gk8rhPZdg4C8.jpg'),
  portrait('xu_kai', '许凯', 'MAN', 'wEfatQWa3v9tNtmgr5LOOmFSSJj.jpg'),
  portrait('hou_minghao', '侯明昊', 'MAN', 'mhu2D7aWA49izHguvxx3tH9LsJX.jpg'),
  portrait('wei_daxun', '魏大勋', 'MAN', '8zDh8Tp6xbVSpxr307alnGqUiJP.jpg'),
  portrait('huang_jingyu', '黄景瑜', 'MAN', 'mc7HlXJU0Sr5WkodEHS3csaxi6E.jpg'),
  portrait('zhu_yilong', '朱一龙', 'MAN', 'tdm21vg4E7ubhd429UT1UpPpFGo.jpg'),
  portrait('zhang_ruoyun', '张若昀', 'MAN', 'dnNTcRc58ikoJ0JihisgXYTwr75.jpg'),
  portrait('hu_ge', '胡歌', 'MAN', 'vmNDYhGMFReeHGqbTwFcFgAq9Ep.jpg'),
] as const;

export const CELEBRITY_PORTRAITS_BY_GENDER = {
  WOMAN: WOMAN_CELEBRITY_PORTRAITS,
  MAN: MAN_CELEBRITY_PORTRAITS,
} as const;

export const ALL_CANDIDATE_CELEBRITY_PORTRAITS = [
  ...WOMAN_CELEBRITY_PORTRAITS,
  ...MAN_CELEBRITY_PORTRAITS,
] as const;

export const CURRENT_USER_CELEBRITY_PORTRAIT = portrait(
  'wang_anyu',
  '王安宇',
  'MAN',
  '7ai55C0CoOdzOlkAOpfatW5xuh.jpg',
);

export const selectCelebrityPortrait = (
  gender: MockProfileGender,
  genderOrdinal: number,
): CelebrityPortrait => {
  const pool = CELEBRITY_PORTRAITS_BY_GENDER[gender];
  const selected = pool[genderOrdinal];
  if (!selected) {
    throw new RangeError(`Not enough ${gender} celebrity portraits for mock profile ${genderOrdinal}.`);
  }
  return selected;
};

export const toCelebrityMedia = (
  profileIndex: number,
  ordinal: number,
  displayName: string,
  artwork: CelebrityPortrait,
): MediaAsset => ({
  id: `media_synth_${String(profileIndex + 1).padStart(3, '0')}_${ordinal + 1}`,
  url: artwork.url,
  alt: `${displayName}的示例头像`,
  width: artwork.width,
  height: artwork.height,
});
