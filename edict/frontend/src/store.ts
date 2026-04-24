/**
 * Zustand Store — 삼성육부 관제판 상태 관리
 * HTTP 5초 폴링, WebSocket 없음
 */

import { create } from 'zustand';
import {
  api,
  type Task,
  type LiveStatus,
  type AgentConfig,
  type OfficialsData,
  type AgentsStatusData,
  type MorningBrief,
  type SubConfig,
  type ChangeLogEntry,
} from './api';
import { koText } from './i18n';

// ── Pipeline Definition (PIPE) ──

export const PIPE = [
  { key: 'Inbox',    dept: '皇上',   icon: '👑', action: '지시' },
  { key: 'Taizi',    dept: '太子',   icon: '🤴', action: '분류' },
  { key: 'Zhongshu', dept: '中书省', icon: '📜', action: '초안 작성' },
  { key: 'Menxia',   dept: '门下省', icon: '🔍', action: '심의' },
  { key: 'Assigned', dept: '尚书省', icon: '📮', action: '배정' },
  { key: 'Doing',    dept: '六部',   icon: '⚙️', action: '실행' },
  { key: 'Review',   dept: '尚书省', icon: '🔎', action: '취합' },
  { key: 'Done',     dept: '回奏',   icon: '✅', action: '완료' },
] as const;

export const PIPE_STATE_IDX: Record<string, number> = {
  Inbox: 0, Pending: 0, Taizi: 1, Zhongshu: 2, Menxia: 3,
  Assigned: 4, Doing: 5, Review: 6, Done: 7, Blocked: 5, Cancelled: 5, Next: 4,
};

export const DEPT_COLOR: Record<string, string> = {
  '太子': '#e8a040', '中书省': '#a07aff', '门下省': '#6a9eff', '尚书省': '#6aef9a',
  '礼部': '#f5c842', '户部': '#ff9a6a', '兵部': '#ff5270', '刑部': '#cc4444',
  '工部': '#44aaff', '吏部': '#9b59b6', '皇上': '#ffd700', '回奏': '#2ecc8a',
};

export const STATE_LABEL: Record<string, string> = {
  Inbox: '수신', Pending: '대기 중', Taizi: '태자 분류', Zhongshu: '중서성 초안',
  Menxia: '문하성 심의', Assigned: '배정됨', Doing: '실행 중', Review: '검토 대기',
  Done: '완료됨', Blocked: '차단됨', Cancelled: '취소됨', Next: '실행 대기',
};

export function deptColor(d: string): string {
  return DEPT_COLOR[d] || '#6a9eff';
}

export function stateLabel(t: Task): string {
  const r = t.review_round || 0;
  if (t.state === 'Menxia' && r > 1) return `문하성 심의 (${r}차)`;
  if (t.state === 'Zhongshu' && r > 0) return `중서성 수정 (${r}차)`;
  return STATE_LABEL[t.state] || t.state;
}

export function isEdict(t: Task): boolean {
  return /^JJC-/i.test(t.id || '');
}

export function isSession(t: Task): boolean {
  return /^(OC-|MC-)/i.test(t.id || '');
}

export function isArchived(t: Task): boolean {
  return !!t.archived;
}

export type PipeStatus = { key: string; dept: string; icon: string; action: string; status: 'done' | 'active' | 'pending' };

export function getPipeStatus(t: Task): PipeStatus[] {
  const stateIdx = PIPE_STATE_IDX[t.state] ?? 4;
  return PIPE.map((stage, i) => ({
    ...stage,
    status: (i < stateIdx ? 'done' : i === stateIdx ? 'active' : 'pending') as 'done' | 'active' | 'pending',
  }));
}

// ── Tabs ──

export type TabKey =
  | 'edicts' | 'monitor' | 'officials' | 'models'
  | 'skills' | 'sessions' | 'memorials' | 'templates' | 'morning' | 'court';

export const TAB_DEFS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'edicts',    label: '지시 보드', icon: '📜' },
  { key: 'court',     label: '조정 회의', icon: '🏛️' },
  { key: 'monitor',   label: '부서 스케줄', icon: '🔌' },
  { key: 'officials', label: '관원 현황', icon: '👔' },
  { key: 'models',    label: '모델 설정', icon: '🤖' },
  { key: 'skills',    label: '스킬 설정', icon: '🎯' },
  { key: 'sessions',  label: '작은 작업',   icon: '💬' },
  { key: 'memorials', label: '보고서함',   icon: '📜' },
  { key: 'templates', label: '지시 템플릿',     icon: '📋' },
  { key: 'morning',   label: '오늘의 브리핑', icon: '🌅' },
];

// ── DEPTS for monitor ──

export const DEPTS = [
  { id: 'taizi',    label: '太子',   emoji: '🤴', role: '太子',     rank: '储君' },
  { id: 'zhongshu', label: '中书省', emoji: '📜', role: '中书令',   rank: '正一品' },
  { id: 'menxia',   label: '门下省', emoji: '🔍', role: '侍中',     rank: '正一品' },
  { id: 'shangshu', label: '尚书省', emoji: '📮', role: '尚书令',   rank: '正一品' },
  { id: 'libu',     label: '礼部',   emoji: '📝', role: '礼部尚书', rank: '正二品' },
  { id: 'hubu',     label: '户部',   emoji: '💰', role: '户部尚书', rank: '正二品' },
  { id: 'bingbu',   label: '兵部',   emoji: '⚔️', role: '兵部尚书', rank: '正二品' },
  { id: 'xingbu',   label: '刑部',   emoji: '⚖️', role: '刑部尚书', rank: '正二品' },
  { id: 'gongbu',   label: '工部',   emoji: '🔧', role: '工部尚书', rank: '正二品' },
  { id: 'libu_hr',  label: '吏部',   emoji: '👔', role: '吏部尚书', rank: '正二品' },
  { id: 'zaochao',  label: '钦天监', emoji: '📰', role: '朝报官',   rank: '正三品' },
];

// ── Templates ──

export interface TemplateParam {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  default?: string;
  required?: boolean;
  options?: string[];
}

export interface Template {
  id: string;
  cat: string;
  icon: string;
  name: string;
  desc: string;
  depts: string[];
  est: string;
  cost: string;
  params: TemplateParam[];
  command: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'tpl-weekly-report', cat: '일상 업무', icon: '📝', name: '주간 보고서 생성',
    desc: '이번 주 보드 데이터와 각 부서 산출물을 바탕으로 구조화된 주간 보고서를 생성합니다',
    depts: ['户部', '礼部'], est: '~10분', cost: '¥0.5',
    params: [
      { key: 'date_range', label: '보고 기간', type: 'text', default: '이번 주', required: true },
      { key: 'focus', label: '중점 항목(쉼표로 구분)', type: 'text', default: '프로젝트 진행,다음 주 계획' },
      { key: 'format', label: '출력 형식', type: 'select', options: ['Markdown', 'Feishu 문서'], default: 'Markdown' },
    ],
    command: '{date_range} 주간 보고서를 생성해 주세요. 중점 항목은 {focus}이고, 출력 형식은 {format}입니다.',
  },
  {
    id: 'tpl-code-review', cat: '엔지니어링', icon: '🔍', name: '코드 리뷰',
    desc: '지정한 저장소나 파일의 품질을 점검하고 문제 목록과 개선안을 정리합니다',
    depts: ['兵部', '刑部'], est: '~20분', cost: '¥2',
    params: [
      { key: 'repo', label: '저장소/파일 경로', type: 'text', required: true },
      { key: 'scope', label: '검토 범위', type: 'select', options: ['전체', '증분(최근 commit)', '지정 파일'], default: '증분(최근 commit)' },
      { key: 'focus', label: '중점 검토(선택)', type: 'text', default: '보안 취약점,오류 처리,성능' },
    ],
    command: '{repo}에 대해 코드 리뷰를 진행해 주세요. 범위: {scope}. 중점 검토: {focus}.',
  },
  {
    id: 'tpl-api-design', cat: '엔지니어링', icon: '⚡', name: 'API 설계 및 구현',
    desc: '요구사항 정리부터 RESTful API 설계, 구현, 테스트까지 진행합니다',
    depts: ['中书省', '兵部'], est: '~45분', cost: '¥3',
    params: [
      { key: 'requirement', label: '요구사항', type: 'textarea', required: true },
      { key: 'tech', label: '기술 스택', type: 'select', options: ['Python/FastAPI', 'Node/Express', 'Go/Gin'], default: 'Python/FastAPI' },
      { key: 'auth', label: '인증 방식', type: 'select', options: ['JWT', 'API Key', '없음'], default: 'JWT' },
    ],
    command: '{tech} 기반 RESTful API를 설계하고 구현해 주세요: {requirement}. 인증 방식: {auth}.',
  },
  {
    id: 'tpl-competitor', cat: '데이터 분석', icon: '📊', name: '경쟁사 분석',
    desc: '경쟁사 사이트 데이터를 수집해 비교 분석하고 구조화된 보고서를 생성합니다',
    depts: ['兵部', '户部', '礼部'], est: '~60분', cost: '¥5',
    params: [
      { key: 'targets', label: '경쟁사 이름/URL(줄마다 하나)', type: 'textarea', required: true },
      { key: 'dimensions', label: '분석 기준', type: 'text', default: '제품 기능,가격 전략,사용자 평가' },
      { key: 'format', label: '출력 형식', type: 'select', options: ['Markdown 보고서', '표 비교'], default: 'Markdown 보고서' },
    ],
    command: '아래 경쟁사를 분석해 주세요:\n{targets}\n\n분석 기준: {dimensions}. 출력 형식: {format}.',
  },
  {
    id: 'tpl-data-report', cat: '데이터 분석', icon: '📈', name: '데이터 보고서',
    desc: '지정한 데이터셋을 정제, 분석, 시각화하고 분석 보고서를 작성합니다',
    depts: ['户部', '礼部'], est: '~30분', cost: '¥2',
    params: [
      { key: 'data_source', label: '데이터 소스 설명/경로', type: 'text', required: true },
      { key: 'questions', label: '분석 질문(줄마다 하나)', type: 'textarea' },
      { key: 'viz', label: '시각화 차트 필요 여부', type: 'select', options: ['예', '아니오'], default: '예' },
    ],
    command: '{data_source} 데이터를 분석해 주세요. {questions}\n시각화 필요 여부: {viz}.',
  },
  {
    id: 'tpl-blog', cat: '콘텐츠 작성', icon: '✍️', name: '블로그 글',
    desc: '주제와 요구사항을 바탕으로 완성도 높은 블로그 글을 작성합니다',
    depts: ['礼部'], est: '~15분', cost: '¥1',
    params: [
      { key: 'topic', label: '글 주제', type: 'text', required: true },
      { key: 'audience', label: '대상 독자', type: 'text', default: '기술 독자' },
      { key: 'length', label: '희망 분량', type: 'select', options: ['~1000자', '~2000자', '~3000자'], default: '~2000자' },
      { key: 'style', label: '스타일', type: 'select', options: ['기술 튜토리얼', '의견/해설', '사례 분석'], default: '기술 튜토리얼' },
    ],
    command: '「{topic}」에 관한 블로그 글을 작성해 주세요. 대상 독자: {audience}. 분량: {length}. 스타일: {style}.',
  },
  {
    id: 'tpl-deploy', cat: '엔지니어링', icon: '🚀', name: '배포 계획',
    desc: '배포 체크리스트, Docker 구성, CI/CD 흐름을 포함한 계획을 생성합니다',
    depts: ['兵部', '工部'], est: '~25분', cost: '¥2',
    params: [
      { key: 'project', label: '프로젝트 이름/설명', type: 'text', required: true },
      { key: 'env', label: '배포 환경', type: 'select', options: ['Docker', 'K8s', 'VPS', 'Serverless'], default: 'Docker' },
      { key: 'ci', label: 'CI/CD 도구', type: 'select', options: ['GitHub Actions', 'GitLab CI', '없음'], default: 'GitHub Actions' },
    ],
    command: '프로젝트 「{project}」의 {env} 배포 계획을 작성해 주세요. CI/CD 도구는 {ci}를 사용합니다.',
  },
  {
    id: 'tpl-email', cat: '콘텐츠 작성', icon: '📧', name: '메일/공지 문안',
    desc: '상황과 목적에 맞는 전문적인 메일 또는 공지 문안을 작성합니다',
    depts: ['礼部'], est: '~5분', cost: '¥0.3',
    params: [
      { key: 'scenario', label: '사용 상황', type: 'select', options: ['비즈니스 메일', '제품 출시', '고객 공지', '내부 공지'], default: '비즈니스 메일' },
      { key: 'purpose', label: '목적/내용', type: 'textarea', required: true },
      { key: 'tone', label: '톤', type: 'select', options: ['격식 있게', '친근하게', '간결하게'], default: '격식 있게' },
    ],
    command: '{scenario} 문안을 작성해 주세요. 톤: {tone}. 내용: {purpose}.',
  },
  {
    id: 'tpl-standup', cat: '일상 업무', icon: '🗓️', name: '일일 스탠드업 요약',
    desc: '각 부서의 오늘 진행 상황과 내일 계획을 모아 스탠드업 요약을 작성합니다',
    depts: ['尚书省'], est: '~5분', cost: '¥0.3',
    params: [
      { key: 'range', label: '요약 범위', type: 'select', options: ['오늘', '최근 24시간', '어제+오늘'], default: '오늘' },
    ],
    command: '{range} 각 부서의 진행 상황과 할 일을 취합해 스탠드업 요약을 작성해 주세요.',
  },
];

export const TPL_CATS = [
  { name: '전체', icon: '📋' },
  { name: '일상 업무', icon: '💼' },
  { name: '데이터 분석', icon: '📊' },
  { name: '엔지니어링', icon: '⚙️' },
  { name: '콘텐츠 작성', icon: '✍️' },
];

// ── Main Store ──

interface AppStore {
  // Data
  liveStatus: LiveStatus | null;
  agentConfig: AgentConfig | null;
  changeLog: ChangeLogEntry[];
  officialsData: OfficialsData | null;
  agentsStatusData: AgentsStatusData | null;
  morningBrief: MorningBrief | null;
  subConfig: SubConfig | null;

  // UI State
  activeTab: TabKey;
  edictFilter: 'active' | 'archived' | 'all';
  sessFilter: string;
  tplCatFilter: string;
  selectedOfficial: string | null;
  modalTaskId: string | null;
  countdown: number;

  // Toast
  toasts: { id: number; msg: string; type: 'ok' | 'err' }[];

  // Actions
  setActiveTab: (tab: TabKey) => void;
  setEdictFilter: (f: 'active' | 'archived' | 'all') => void;
  setSessFilter: (f: string) => void;
  setTplCatFilter: (f: string) => void;
  setSelectedOfficial: (id: string | null) => void;
  setModalTaskId: (id: string | null) => void;
  setCountdown: (n: number) => void;
  toast: (msg: string, type?: 'ok' | 'err') => void;

  // Data fetching
  loadLive: () => Promise<void>;
  loadAgentConfig: () => Promise<void>;
  loadOfficials: () => Promise<void>;
  loadAgentsStatus: () => Promise<void>;
  loadMorning: () => Promise<void>;
  loadSubConfig: () => Promise<void>;
  loadAll: () => Promise<void>;
}

let _toastId = 0;

export const useStore = create<AppStore>((set, get) => ({
  liveStatus: null,
  agentConfig: null,
  changeLog: [],
  officialsData: null,
  agentsStatusData: null,
  morningBrief: null,
  subConfig: null,

  activeTab: 'edicts',
  edictFilter: 'active',
  sessFilter: 'all',
  tplCatFilter: '전체',
  selectedOfficial: null,
  modalTaskId: null,
  countdown: 5,

  toasts: [],

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    const s = get();
    if (['models', 'skills', 'sessions'].includes(tab) && !s.agentConfig) s.loadAgentConfig();
    if (tab === 'officials' && !s.officialsData) s.loadOfficials();
    if (tab === 'monitor') s.loadAgentsStatus();
    if (tab === 'morning' && !s.morningBrief) s.loadMorning();
  },
  setEdictFilter: (f) => set({ edictFilter: f }),
  setSessFilter: (f) => set({ sessFilter: f }),
  setTplCatFilter: (f) => set({ tplCatFilter: f }),
  setSelectedOfficial: (id) => set({ selectedOfficial: id }),
  setModalTaskId: (id) => set({ modalTaskId: id }),
  setCountdown: (n) => set({ countdown: n }),

  toast: (msg, type = 'ok') => {
    const id = ++_toastId;
    set((s) => ({ toasts: [...s.toasts, { id, msg: koText(msg), type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },

  loadLive: async () => {
    try {
      const data = await api.liveStatus();
      set({ liveStatus: data });
      // Also preload officials for monitor tab
      const s = get();
      if (!s.officialsData) {
        api.officialsStats().then((d) => set({ officialsData: d })).catch(() => {});
      }
    } catch {
      // silently fail
    }
  },

  loadAgentConfig: async () => {
    try {
      const cfg = await api.agentConfig();
      const log = await api.modelChangeLog();
      set({ agentConfig: cfg, changeLog: log });
    } catch {
      // silently fail
    }
  },

  loadOfficials: async () => {
    try {
      const data = await api.officialsStats();
      set({ officialsData: data });
    } catch {
      // silently fail
    }
  },

  loadAgentsStatus: async () => {
    try {
      const data = await api.agentsStatus();
      set({ agentsStatusData: data });
    } catch {
      set({ agentsStatusData: null });
    }
  },

  loadMorning: async () => {
    try {
      const [brief, config] = await Promise.all([api.morningBrief(), api.morningConfig()]);
      set({ morningBrief: brief, subConfig: config });
    } catch {
      // silently fail
    }
  },

  loadSubConfig: async () => {
    try {
      const config = await api.morningConfig();
      set({ subConfig: config });
    } catch {
      // silently fail
    }
  },

  loadAll: async () => {
    const s = get();
    await s.loadLive();
    const tab = s.activeTab;
    if (['models', 'skills'].includes(tab)) await s.loadAgentConfig();
  },
}));

// ── Countdown & Polling ──

let _cdTimer: ReturnType<typeof setInterval> | null = null;

export function startPolling() {
  if (_cdTimer) return;
  useStore.getState().loadAll();
  _cdTimer = setInterval(() => {
    const s = useStore.getState();
    const cd = s.countdown - 1;
    if (cd <= 0) {
      s.setCountdown(5);
      s.loadAll();
    } else {
      s.setCountdown(cd);
    }
  }, 1000);
}

export function stopPolling() {
  if (_cdTimer) {
    clearInterval(_cdTimer);
    _cdTimer = null;
  }
}

// ── Utility ──

export function esc(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    return `${Math.floor(hrs / 24)}일 전`;
  } catch {
    return '';
  }
}
