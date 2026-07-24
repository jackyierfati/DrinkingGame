/*
 * 真实词条库（从抖音「随机喝酒大转盘 / 小决定App」视频逐帧抄录）
 * ------------------------------------------------------------------
 * 玩法：转到某条，符合「…的人」条件的人就喝。
 * 这些是从视频里一帧一帧扒下来的原汁原味词条，是整个词库的「种子」。
 *
 * 用 window.ENTRIES_DATA 挂到全局，方便 file:// 直接打开也能用（不走 fetch）。
 * 每条：{ text, category }
 *   category: 习惯 / 经历 / 才艺 / 爱好 / 其他
 */
window.ENTRIES_DATA = [
  // —— 习惯：日常生活习惯 ——
  { text: '每天必须吃甜点的人', category: '习惯' },
  { text: '每天喝两杯以上咖啡的人', category: '习惯' },
  { text: '早上经常睡到10点的人', category: '习惯' },
  { text: '经常忘记关房间灯的人', category: '习惯' },
  { text: '每周发朋友圈超过两次的人', category: '习惯' },
  { text: '一个月吃三次火锅的人', category: '习惯' },
  { text: '每周吃宵夜超过两次的人', category: '习惯' },
  { text: '每周吃一次烧烤的人', category: '习惯' },
  { text: '每天吃零食超过两次的人', category: '习惯' },
  { text: '每周点外卖超过三次的人', category: '习惯' },
  { text: '每天吃冰淇淋的人', category: '习惯' },
  { text: '日常穿拖鞋出门的人', category: '习惯' },
  { text: '熬夜看球赛的人', category: '习惯' },
  { text: 'KTV必点经典老歌的人', category: '习惯' },
  { text: '吃蛋糕从不留奶油的人', category: '习惯' },
  { text: '手机里自拍超过50张的人', category: '习惯' },

  // —— 经历：发生在你身上的事 ——
  { text: '今年被雨淋湿超过三次的人', category: '经历' },
  { text: '收到过交通罚单的人', category: '经历' },
  { text: '被催婚超过五次的人', category: '经历' },
  { text: '被父母唠叨学习或工作的人', category: '经历' },
  { text: '本周迟到过至少一次的人', category: '经历' },
  { text: '被电瓶车撞过的人', category: '经历' },
  { text: '被叫错名字超过十次的人', category: '经历' },
  { text: '被陌生人认错过的人', category: '经历' },
  { text: '被老师点名批评过的人', category: '经历' },
  { text: '被朋友吐槽过性格的人', category: '经历' },
  { text: '被虫子吓到尖叫过的人', category: '经历' },
  { text: '因吃醋和朋友吵架过的人', category: '经历' },
  { text: '借钱给朋友超过三次的人', category: '经历' },
  { text: '被朋友拉去当模特的人', category: '经历' },
  { text: '被认错性别过的人', category: '经历' },
  { text: '收到过奇怪礼物的人', category: '经历' },
  { text: '讲笑话没人笑过的人', category: '经历' },
  { text: '夏天晒黑两个色号的人', category: '经历' },
  { text: '夏天被蚊子咬过10次以上的人', category: '经历' },
  { text: '买东西砍价成功过的人', category: '经历' },

  // —— 才艺：能秀一手的技能 ——
  { text: '会用筷子夹豆子的人', category: '才艺' },
  { text: '会用三种字体写字的人', category: '才艺' },
  { text: '能讲一句人生哲理的人', category: '才艺' },
  { text: '能讲一件童年糗事的人', category: '才艺' },
  { text: '能模仿卡通人物声音的人', category: '才艺' },
  { text: '能说三种以上方言的人', category: '才艺' },
  { text: '会做三道以上拿手菜的人', category: '才艺' },
  { text: '能背一首古诗的人', category: '才艺' },
  { text: '能用外语说一段话的人', category: '才艺' },
  { text: '能模仿三种动物叫声的人', category: '才艺' },
  { text: '会跳任何一种街舞的人', category: '才艺' },
  { text: '能唱出高音C的人', category: '才艺' },
  { text: '能画一幅素描的人', category: '才艺' },
  { text: '能模仿某位名人讲话的人', category: '才艺' },
  { text: '会背至少三句土味情话的人', category: '才艺' },
  { text: '讲冷幽默让大家沉默的人', category: '才艺' },
  { text: '能吃完一整份麻辣火锅的人', category: '才艺' },
  { text: '跑步能坚持10公里的人', category: '才艺' },
  { text: '自制过表情包的人', category: '才艺' },

  // —— 爱好：兴趣与影音娱乐 ——
  { text: '看过至少五部恐怖片的人', category: '爱好' },
  { text: '看过十部科幻片的人', category: '爱好' },
  { text: '读过100本以上小说的人', category: '爱好' },
  { text: '每周追至少一档综艺的人', category: '爱好' },
  { text: '追过美食节目的人', category: '爱好' },
  { text: '追过三部悬疑剧的人', category: '爱好' },
  { text: '看过五部纪录片的人', category: '爱好' },
  { text: '玩过十种以上桌游的人', category: '爱好' },
  { text: '手机里有80年代歌曲的人', category: '爱好' },
  { text: '每周追一档真人秀的人', category: '爱好' },
  { text: '知道五个冷知识的人', category: '爱好' },
  { text: '相信星座决定命运的人', category: '爱好' },
  { text: '收藏过奇怪物品的人', category: '爱好' },
  { text: '最爱吃热带水果的人', category: '爱好' },

  // —— 其他：身份 / 属性类 ——
  { text: '买过网红爆款产品的人', category: '其他' },
  { text: '去过五个以上城市的人', category: '其他' },
  { text: '家里养过两只以上宠物的人', category: '其他' },
  { text: '穿42码以上鞋子的人', category: '其他' },
  { text: '穿过奇特图案衣服的人', category: '其他' },
];
