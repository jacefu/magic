import { useState, useEffect, useCallback } from "react";
import {
  getSoulContent,
  sendSoulContent,
  useAuthStore,
} from "@magic/matrix-client";

interface UseSoulMemoryOptions {
  roomId: string;
  fileType: "soul" | "memory";
}

interface SoulMemoryState {
  savedContent: string;
  editContent: string;
  meta: {
    version: number;
    editor: string;
    lastSaved: number | null;
  };
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useSoulMemory({ roomId, fileType }: UseSoulMemoryOptions) {
  const userId = useAuthStore((s) => s.userId);
  const [state, setState] = useState<SoulMemoryState>({
    savedContent: "",
    editContent: "",
    meta: { version: 0, editor: "", lastSaved: null },
    isDirty: false,
    isSaving: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    let data: ReturnType<typeof getSoulContent> = null;
    try {
      data = getSoulContent(roomId, fileType);
    } catch {
      data = null;
    }

    if (cancelled) return;

    if (data) {
      setState({
        savedContent: data.content,
        editContent: data.content,
        meta: {
          version: data.version,
          editor: data.editor,
          lastSaved: Date.now(),
        },
        isDirty: false,
        isSaving: false,
        isLoading: false,
        error: null,
      });
    } else {
      const defaultContent =
        fileType === "soul" ? getDefaultSoul() : getDefaultMemory();
      setState({
        savedContent: "",
        editContent: defaultContent,
        meta: { version: 0, editor: "", lastSaved: null },
        isDirty: true,
        isSaving: false,
        isLoading: false,
        error: null,
      });
    }

    return () => {
      cancelled = true;
    };
  }, [roomId, fileType]);

  const setEditContent = useCallback((content: string) => {
    setState((s) => ({
      ...s,
      editContent: content,
      isDirty: content !== s.savedContent,
    }));
  }, []);

  const save = useCallback(async () => {
    if (!userId) return;

    setState((s) => ({ ...s, isSaving: true, error: null }));

    try {
      const newVersion = state.meta.version + 1;
      await sendSoulContent(roomId, {
        content: state.editContent,
        file_type: fileType,
        version: newVersion,
        editor: userId,
      });

      setState((s) => ({
        ...s,
        savedContent: s.editContent,
        meta: {
          version: newVersion,
          editor: userId,
          lastSaved: Date.now(),
        },
        isDirty: false,
        isSaving: false,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "保存失败";
      setState((s) => ({ ...s, isSaving: false, error: msg }));
    }
  }, [roomId, fileType, userId, state.editContent, state.meta.version]);

  const revert = useCallback(() => {
    setState((s) => ({
      ...s,
      editContent: s.savedContent,
      isDirty: false,
    }));
  }, []);

  return {
    ...state,
    setEditContent,
    save,
    revert,
  };
}

function getDefaultSoul(): string {
  return `# SOUL.md

## 身份
你是一个专业的 AI 助手。

## 目标
帮助用户高效完成任务。

## 原则
- 准确、简洁、有帮助
- 主动沟通进展和问题
- 遵守安全和隐私规范
`;
}

function getDefaultMemory(): string {
  return `# MEMORY.md

## 项目上下文
（在此记录项目相关的长期记忆）

## 用户偏好
（在此记录用户的工作习惯和偏好）

## 历史决策
（在此记录重要的技术和业务决策）
`;
}
