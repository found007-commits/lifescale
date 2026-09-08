// Optional, local writing starters. Never infer a topic from gender or private entries.
const topics = [
  { label: "普通一天", questions: ["今天，有哪个小片刻让你停了一下？", "今天看见了什么，想留给以后的自己？", "如果只留下一句话，你想写什么？"] },
  { label: "留给自己", questions: ["今天，有什么时间是留给自己的？", "今天，你想对自己说一句什么话？", "此刻，有什么事可以先放一放？"] },
  { label: "人与关系", questions: ["今天，谁的一句话让你记住了？", "最近，你想感谢谁，也想感谢自己什么？", "今天，你希望被怎样理解？"] },
  { label: "小小变化", questions: ["最近，你发现自己有了什么小变化？", "今天，有没有一件按自己心意做的事？", "有什么想尝试的事，还可以慢慢来？"] },
  { label: "此刻感受", questions: ["如果此刻的心情有颜色，会是什么？", "今天，让你放松的一刻是什么时候？", "有没有一种感受，暂时还说不清？"] },
];
function questionAt(topic, index = 0) {
  const questions = topics[topic]?.questions;
  return questions ? questions[((index % questions.length) + questions.length) % questions.length] : "";
}
module.exports = { topics, questionAt };
