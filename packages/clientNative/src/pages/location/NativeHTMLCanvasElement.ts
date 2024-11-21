import {ExpoWebGLRenderingContext} from 'expo-gl';

export type NativeWebGLRenderingContext = ExpoWebGLRenderingContext & {
  drawingBufferWidth: number;
  drawingBufferHeight: number;
};

export class NativeHTMLCanvasElement implements HTMLCanvasElement {
  public width: number;
  public height: number;
  public style: Record<string, string>;
  public addEventListener = () => {};
  public removeEventListener = () => {};
  public clientHeight: number;

  private context: NativeWebGLRenderingContext;

  constructor(context: NativeWebGLRenderingContext) {
    (this.width = context.drawingBufferWidth),
      (this.height = context.drawingBufferHeight),
      (this.style = {}),
      (this.clientHeight = context.drawingBufferHeight),
      (this.context = context);
  }

  public getContext(glContext: 'webgl2') {
    if (glContext === 'webgl2') {
      return this.context;
    }
    throw new Error(`Unsupported context: ${glContext}`);
  }
}
