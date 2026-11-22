export interface TeamChannel {
  id: string;
  name: string;
  webhookUrl: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TitleSize = 'Medium' | 'Large' | 'ExtraLarge';
export type TextAlignment = 'right' | 'center' | 'left';
export type PriorityLevel = 'عادي' | 'مهم' | 'عاجل';

export interface Announcement {
  id: string;
  title: string;
  subheading: string;
  content: string;
  contentColor: string;
  priority: PriorityLevel | string;
  status: string;
  channelIds: string;
  headerColor: string;
  titleSize: TitleSize | string;
  titleAlignment: TextAlignment | string;
  alignment: TextAlignment | string;
  announcementDate: string;
  source: string;
  imageUrl: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishChannelResult {
  channel: string;
  ok: boolean;
  detail: string;
}

export interface PublishResponse {
  success: boolean;
  totalChannels: number;
  successful: number;
  results: PublishChannelResult[];
  error?: string;
}
