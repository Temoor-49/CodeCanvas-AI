
export interface AnalysisResult {
  uiType: string;
  components: string[];
  layout: string;
  colors: string;
}

export interface TransformationResult {
  analysis: AnalysisResult;
  htmlCode: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
