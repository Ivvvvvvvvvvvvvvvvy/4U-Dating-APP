export type ActivityKind = 'duo' | 'group';
export type ActivityCategory = '展览' | '散步' | '电影' | '运动' | '音乐';

export type Person = {
  id: string;
  name: string;
  age: number;
  avatar: string;
  verified?: boolean;
  bio: string;
  tags: string[];
};

export type Activity = {
  id: string;
  kind: ActivityKind;
  category: ActivityCategory;
  title: string;
  kicker: string;
  image: string;
  date: string;
  time: string;
  district: string;
  distance: string;
  price: string;
  duration: string;
  confirmed: number;
  minPeople: number;
  maxPeople: number;
  organizer: Person;
  members: Person[];
  matchLabel: string;
  matchReason: string;
  description: string;
  plan: string[];
  atmosphere: string[];
  notice: string;
};

export const people: Person[] = [
  {
    id: 'lan',
    name: '阿岚',
    age: 28,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=82',
    verified: true,
    bio: '品牌设计师，喜欢把周末过得慢一点。',
    tags: ['摄影', '慢热', '夜游'],
  },
  {
    id: 'zhou',
    name: '小周',
    age: 27,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=82',
    verified: true,
    bio: '产品经理，抱石新手，也喜欢城市骑行。',
    tags: ['运动', '直接沟通', '咖啡'],
  },
  {
    id: 'ning',
    name: '宁宁',
    age: 26,
    avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=240&q=82',
    bio: '独立策展从业者，周末常在城市里找新空间。',
    tags: ['艺术', '黑胶', '散步'],
  },
  {
    id: 'chen',
    name: '陈一',
    age: 29,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=82',
    verified: true,
    bio: '建筑师，偏爱老街、胶片和不赶时间的旅行。',
    tags: ['建筑', '胶片', 'City Walk'],
  },
];

export const activities: Activity[] = [
  {
    id: 'monet-night',
    kind: 'duo',
    category: '展览',
    title: '莫奈夜展后，沿江散步 40 分钟',
    kicker: '把第一次见面留给光影与晚风',
    image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=900&q=86',
    date: '8月29日 周六',
    time: '18:30',
    district: '徐汇滨江',
    distance: '2.4 km',
    price: '¥88',
    duration: '约 3 小时',
    confirmed: 1,
    minPeople: 2,
    maxPeople: 2,
    organizer: people[0],
    members: [people[0]],
    matchLabel: '很合拍',
    matchReason: '摄影、慢热与夜游偏好相近',
    description: '先看莫奈沉浸展，再沿江慢走。我们不赶着聊完所有话题，只想给一次相遇留下舒服的空间。',
    plan: ['18:20 展馆入口集合', '18:30 一起观展', '20:00 沿江散步', '20:40 自然结束或自由续场'],
    atmosphere: ['双人同行', '自然交流', '公共场所'],
    notice: '参加不代表表达好感；活动结束后，双方都愿意继续了解才会开启长期私聊。',
  },
  {
    id: 'sunset-walk',
    kind: 'group',
    category: '散步',
    title: '梧桐区日落 City Walk + 小酒馆',
    kicker: '慢慢走，也慢慢认识彼此',
    image: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=86',
    date: '8月30日 周日',
    time: '16:30',
    district: '衡复风貌区',
    distance: '3.1 km',
    price: '¥59 起',
    duration: '约 4 小时',
    confirmed: 5,
    minPeople: 4,
    maxPeople: 8,
    organizer: people[3],
    members: [people[3], people[2], people[1]],
    matchLabel: '3 位同频',
    matchReason: '城市漫游、胶片与自然交流',
    description: '从武康路出发，在日落前走过三条安静街巷，最后到一间不吵的小酒馆坐坐。',
    plan: ['16:20 地铁口集合', '16:30 梧桐街区漫步', '18:10 日落合影', '18:40 小酒馆自由交流'],
    atmosphere: ['多人小组', '自然交流', '可不饮酒'],
    notice: '活动中尊重拒绝、不劝酒、不强制交换联系方式。',
  },
  {
    id: 'bouldering',
    kind: 'duo',
    category: '运动',
    title: '新手抱石，互相拍第一条完攀',
    kicker: '一起完成一件有点难的新鲜事',
    image: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=900&q=86',
    date: '9月2日 周三',
    time: '19:30',
    district: '静安寺',
    distance: '1.8 km',
    price: '¥98',
    duration: '约 2 小时',
    confirmed: 1,
    minPeople: 2,
    maxPeople: 2,
    organizer: people[1],
    members: [people[1]],
    matchLabel: '值得认识',
    matchReason: '运动习惯与沟通方式接近',
    description: '都是第一次也没关系，从热身和最简单的线路开始，彼此记录第一条完攀。',
    plan: ['19:20 前台集合', '19:30 热身与安全教学', '19:50 自由尝试', '21:10 拉伸结束'],
    atmosphere: ['双人同行', '新手友好', '轻运动'],
    notice: '请穿方便运动的衣服；场馆装备可租赁，活动中可随时停止。',
  },
  {
    id: 'vinyl-night',
    kind: 'group',
    category: '音乐',
    title: '黑胶试听夜：带一张最近循环',
    kicker: '用一首歌介绍最近的自己',
    image: 'https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&w=900&q=86',
    date: '9月4日 周五',
    time: '20:00',
    district: '愚园路',
    distance: '4.6 km',
    price: '¥88',
    duration: '约 2.5 小时',
    confirmed: 8,
    minPeople: 6,
    maxPeople: 12,
    organizer: people[2],
    members: [people[2], people[0], people[3]],
    matchLabel: '4 位同频',
    matchReason: '独立音乐与安静社交偏好重合',
    description: '每个人带来一首最近循环的歌。我们轮流播放、分享，也留出自然聊天的时间。',
    plan: ['19:50 店内签到', '20:00 第一轮试听', '21:00 自由换座交流', '22:20 活动收尾'],
    atmosphere: ['弹性小组', '音乐分享', '高互动'],
    notice: '不强制发言或交换联系方式；所有拍摄需征得被拍摄者同意。',
  },
];

export const topicCards = [
  { id: 't1', title: '第一次见面，什么活动最不容易冷场？', tag: '约会灵感', replies: 128, color: '#e85d75' },
  { id: 't2', title: '一个人也想去的展，值得为谁等一等', tag: '找同行', replies: 76, color: '#3157d5' },
  { id: 't3', title: '双人同行还是多人小组，你更自在在哪一种？', tag: '热门', replies: 204, color: '#147d69' },
  { id: 't4', title: '第一次参加陌生活动，怎么保护好自己？', tag: '安全经验', replies: 53, color: '#bd6a3b' },
];
