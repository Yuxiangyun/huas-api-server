export type ApiResponse<T> = {
  code: number;
  msg?: string;
  data?: T;
  token?: string;
};

export type CaptchaResponse = {
  sessionId: string;
  image: string;
};

export type LoginParams = {
  sessionId: string;
  username: string;
  password: string;
  code: string;
};

export type ScheduleItem = {
  name: string;
  teacher?: string;
  time?: string;
  location?: string;
  weeks?: string;
  day?: number;
  section?: string;
  weekStr?: string;
};

export type ScheduleResponse = {
  courses: ScheduleItem[];
  _source?: string;
};

export type UserProfile = {
  name: string;
  studentId: string;
  className?: string;
  _source?: string;
};

export type CardTransaction = {
  amount: number;
  time: string;
  type: string;
  desc?: string;
};

export type ECard = {
  balance: number;
  transactions?: CardTransaction[];
  _source?: string;
};
