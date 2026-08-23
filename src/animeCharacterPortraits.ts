import type { MediaAsset } from './domain';

export type AnimePortraitGender = 'WOMAN' | 'MAN' | 'NON_BINARY' | 'SELF_DESCRIBED';

/**
 * Character artwork used in place of real-person photos.
 *
 * The pool is intentionally keyed by the profile's explicit selfGender value.
 * Nicknames, occupations, interests, and other public fields are never used to
 * infer gender. Non-binary/self-described profiles use neutral characters or
 * ensemble artwork.
 */
export interface AnimeCharacterPortrait {
  readonly id: string;
  readonly work: string;
  readonly character: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

const portrait = (
  id: string,
  work: string,
  character: string,
  url: string,
  width: number,
  height: number,
): AnimeCharacterPortrait => ({ id, work, character, url, width, height });

const WOMAN_CHARACTER_PORTRAITS = [
  portrait('nezha_lady_yin', '《哪吒之魔童闹海》', '殷夫人', 'https://static.wikia.nocookie.net/ne-zha/images/b/be/Lady_yin.jpg/revision/latest?cb=20250430201313', 736, 981),
  portrait('luofanchen_yulu', '《落凡尘》', '玉露', 'https://p0.pipi.cn/friday/0c7b48862cfb0516955a445fa72f0231.jpg?imageMogr2/thumbnail/750x750', 536, 750),
  portrait('white_snake_xiaobai', '《白蛇：浮生》', '小白', 'https://white-snake.movie/wp-content/themes/hakuja_main/images/chara2.webp', 1171, 839),
  portrait('demon_slayer_nezuko', '《鬼灭之刃 无限城篇》', '灶门祢豆子', 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/0/0e/Nezuko_anime_right_face.png/revision/latest?cb=20241228000758', 689, 1154),
  portrait('demon_slayer_shinobu', '《鬼灭之刃 无限城篇》', '蝴蝶忍', 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/e/e5/Shinobu_anime.png/revision/latest?cb=20241010231126', 1328, 1897),
  portrait('haikyu_kiyoko', '《排球少年！！垃圾场决战》', '清水洁子', 'https://static.wikia.nocookie.net/haikyuu/images/7/7c/Kiyoko_s4-e1-1.png/revision/latest?cb=20200519170243', 1360, 764),
  portrait('chainsaw_reze', '《电锯人 蕾洁篇》', '蕾洁', 'https://static.wikia.nocookie.net/chainsaw-man/images/8/8a/Reze_Reze_Arc_anime_design.png/revision/latest?cb=20250323073718', 517, 862),
  portrait('chainsaw_power', '《电锯人 蕾洁篇》', '帕瓦', 'https://static.wikia.nocookie.net/chainsaw-man/images/a/ac/Power_anime_design_2.png/revision/latest?cb=20231006042039', 601, 1002),
  portrait('conan_ran', '《名侦探柯南》系列剧场版', '毛利兰', 'https://media.kitsu.app/character/4374/image/large-17cdc2a243d8a777058561f9471e6653.jpeg', 500, 600),
  portrait('inside_out_joy', '《头脑特工队2》', '乐乐', 'https://static.wikia.nocookie.net/insideout/images/5/51/JoyIO2.png/revision/latest?cb=20241123133955', 416, 676),
  portrait('inside_out_anxiety', '《头脑特工队2》', '焦焦', 'https://static.wikia.nocookie.net/insideout/images/e/e3/Inside_Out_2_-_Anxiety.webp/revision/latest?cb=20240606132939', 484, 848),
  portrait('zootopia_judy', '《疯狂动物城2》', '朱迪', 'https://static.wikia.nocookie.net/zootopia/images/3/39/Judy_Hopps_Z2.PNG/revision/latest?cb=20250129161215', 1248, 3069),
] as const;

const MAN_CHARACTER_PORTRAITS = [
  portrait('nezha_ao_bing', '《哪吒之魔童闹海》', '敖丙', 'https://static.wikia.nocookie.net/ne-zha/images/f/f1/Ao_Bing.png/revision/latest?cb=20250522115535', 586, 804),
  portrait('luofanchen_jinfeng', '《落凡尘》', '金风', 'https://p0.pipi.cn/friday/7a79d2d1cd8ba8455e30e14d4b97657a.jpg?imageMogr2/thumbnail/750x750', 536, 750),
  portrait('white_snake_xuxian', '《白蛇：浮生》', '许仙', 'https://white-snake.movie/wp-content/themes/hakuja_main/images/chara1.webp', 1270, 910),
  portrait('demon_slayer_tanjiro', '《鬼灭之刃 无限城篇》', '灶门炭治郎', 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/0/05/Tanjiro_anime_right_face.png/revision/latest?cb=20241228000706', 682, 1191),
  portrait('demon_slayer_giyu', '《鬼灭之刃 无限城篇》', '富冈义勇', 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/4/43/Giyu_anime_design.png/revision/latest?cb=20190831073602', 572, 817),
  portrait('haikyu_hinata', '《排球少年！！垃圾场决战》', '日向翔阳', 'https://static.wikia.nocookie.net/haikyuu/images/d/d2/Hinata_s4-e1-4.png/revision/latest?cb=20200506183149', 1361, 763),
  portrait('haikyu_kenma', '《排球少年！！垃圾场决战》', '孤爪研磨', 'https://static.wikia.nocookie.net/haikyuu/images/8/80/Land_VS_Air_-_Kenma.jpg/revision/latest?cb=20191227141949', 680, 383),
  portrait('chainsaw_denji', '《电锯人 蕾洁篇》', '电次', 'https://static.wikia.nocookie.net/chainsaw-man/images/b/b0/Denji_Reze_Arc_anime_design.png/revision/latest?cb=20250324010006', 517, 866),
  portrait('conan_conan', '《名侦探柯南》系列剧场版', '江户川柯南', 'https://media.kitsu.app/character/4370/image/large-1ebe29fd4b26fb54dd181e5c8c7e038a.jpeg', 500, 600),
  portrait('inside_out_anger', '《头脑特工队2》', '怒怒', 'https://static.wikia.nocookie.net/insideout/images/0/0b/Anger.webp/revision/latest?cb=20240606140628', 676, 601),
  portrait('wild_robot_brightbill', '《荒野机器人》', '亮亮', 'https://static.wikia.nocookie.net/the-wild-robot/images/7/70/Brightbill2.jpg/revision/latest?cb=20241012082626', 1910, 814),
  portrait('zootopia_nick', '《疯狂动物城2》', '尼克', 'https://static.wikia.nocookie.net/zootopia/images/1/1a/Nick_Wilde_Z2.PNG/revision/latest?cb=20250129161100', 2175, 3858),
] as const;

const NEUTRAL_CHARACTER_PORTRAITS = [
  portrait('wild_robot_roz', '《荒野机器人》', '萝斯', 'https://static.wikia.nocookie.net/the-wild-robot/images/f/fd/Roz_twr.jpg/revision/latest?cb=20241007205813', 199, 463),
  portrait('inside_out_ennui', '《头脑特工队2》', '丧丧', 'https://static.wikia.nocookie.net/insideout/images/9/99/Ennui.png/revision/latest?cb=20241123134300', 212, 400),
  portrait('inside_out_embarrassment', '《头脑特工队2》', '尬尬', 'https://static.wikia.nocookie.net/insideout/images/2/22/Embarrassment_Transparent.png/revision/latest?cb=20241217143158', 2084, 3273),
  portrait('zootopia_gary', '《疯狂动物城2》', '盖瑞', 'https://static.wikia.nocookie.net/zootopia/images/8/82/Gary_zootopia_2.png/revision/latest?cb=20251005182643', 1023, 1280),
  portrait('wild_robot_ensemble', '《荒野机器人》', '萝斯与岛上伙伴', 'https://media.themoviedb.org/t/p/w500/oUKsIXIKF52Yd98czewct9cwXdR.jpg', 500, 750),
  portrait('inside_out_ensemble', '《头脑特工队2》', '情绪小队群像', 'https://media.themoviedb.org/t/p/w500/Z0aXIB7qTsO4oicCVyJxTZFYrg.jpg', 500, 750),
  portrait('zootopia_ensemble', '《疯狂动物城2》', '朱迪与尼克群像', 'https://media.themoviedb.org/t/p/w500/sp8eWmg3HwNKdqdgGhoE2XACfO6.jpg', 500, 750),
  portrait('nezha_ensemble', '《哪吒之魔童闹海》', '哪吒与敖丙群像', 'https://media.themoviedb.org/t/p/w500/293Mo4GWf7Tl0TfAr5NFghqeMy7.jpg', 500, 750),
  portrait('luofanchen_ensemble', '《落凡尘》', '金风与玉露群像', 'https://media.themoviedb.org/t/p/w500/dNFtstmRt5UyuB6E5YSRnSCHwyL.jpg', 500, 701),
  portrait('white_snake_ensemble', '《白蛇：浮生》', '小白与许仙群像', 'https://media.themoviedb.org/t/p/w500/yqvuNjOMG8PfzOiyiqX9b92wv6y.jpg', 500, 748),
  portrait('demon_slayer_ensemble', '《鬼灭之刃 无限城篇》', '无限城群像', 'https://media.themoviedb.org/t/p/w500/uS1w291qysNKHl5NvS25pVhfcJQ.jpg', 500, 750),
  portrait('haikyu_ensemble', '《排球少年！！垃圾场决战》', '乌野与音驹群像', 'https://media.themoviedb.org/t/p/w500/chRu7CzagKO9AtGcltDSvCiKOfw.jpg', 500, 750),
  portrait('chainsaw_ensemble', '《电锯人 蕾洁篇》', '蕾洁篇群像', 'https://media.themoviedb.org/t/p/w500/dUbacBfy6M0EBLPssQhJFhtHxIU.jpg', 500, 750),
  portrait('conan_ensemble', '《名侦探柯南》系列剧场版', '剧场版群像', 'https://media.themoviedb.org/t/p/w500/2q27TnpLrxW7lsT3V5AKF9Dt7aG.jpg', 500, 750),
] as const;

const POOLS_BY_GENDER = {
  WOMAN: WOMAN_CHARACTER_PORTRAITS,
  MAN: MAN_CHARACTER_PORTRAITS,
  NON_BINARY: NEUTRAL_CHARACTER_PORTRAITS,
  SELF_DESCRIBED: NEUTRAL_CHARACTER_PORTRAITS,
} as const;

export const ANIME_CHARACTER_PORTRAITS_BY_GENDER = POOLS_BY_GENDER;

export const ALL_ANIME_CHARACTER_PORTRAITS = [
  ...WOMAN_CHARACTER_PORTRAITS,
  ...MAN_CHARACTER_PORTRAITS,
  ...NEUTRAL_CHARACTER_PORTRAITS,
] as const;

export const REQUESTED_ANIME_WORKS = [
  '《哪吒之魔童闹海》',
  '《落凡尘》',
  '《白蛇：浮生》',
  '《鬼灭之刃 无限城篇》',
  '《排球少年！！垃圾场决战》',
  '《电锯人 蕾洁篇》',
  '《名侦探柯南》系列剧场版',
  '《头脑特工队2》',
  '《荒野机器人》',
  '《疯狂动物城2》',
] as const;

export const selectAnimeCharacterPortrait = (
  selfGender: AnimePortraitGender,
  profileIndex: number,
): AnimeCharacterPortrait => {
  const pool = POOLS_BY_GENDER[selfGender];
  return pool[profileIndex % pool.length];
};

export const toAnimeCharacterMedia = (
  profileIndex: number,
  ordinal: number,
  displayName: string,
  artwork: AnimeCharacterPortrait,
): MediaAsset => ({
  id: `media_synth_${String(profileIndex + 1).padStart(3, '0')}_${ordinal + 1}`,
  url: artwork.url,
  alt: `${displayName}的角色头像：${artwork.work}${artwork.character}`,
  width: artwork.width,
  height: artwork.height,
});

/** Current mock user has no explicit gender field, so use the neutral pool. */
export const CURRENT_USER_ANIME_PORTRAIT = NEUTRAL_CHARACTER_PORTRAITS[0];
