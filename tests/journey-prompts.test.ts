import assert from "node:assert/strict";
import test from "node:test";
import { getJourneyPrompt } from "../lib/journey-prompts";

test("the journey starts with a visible first-day prompt", () => {
  const prompt = getJourneyPrompt(0, false, "zh");
  assert.equal(prompt.day, 1);
  assert.match(prompt.label, /第 1 天/);
  assert.match(prompt.body, /第一天/);
});

test("day 100 uses the requested independent reflection message", () => {
  const prompt = getJourneyPrompt(100, true, "zh");
  assert.equal(prompt.day, 100);
  assert.equal(prompt.body, "不要让大数据分析你，不要让别人定义你，回望一下你的一百天，继续前进！");
});
