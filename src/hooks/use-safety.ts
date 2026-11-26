import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  blockUser,
  cancelSession,
  deleteMyAccount,
  leaveGroup,
  listMyBlocks,
  renameGroup,
  reportContent,
  setMyName,
  unblockUser,
} from '@/api/safety';

export { REPORT_REASONS, safetyErrorMessage } from '@/api/safety';
export type { BlockedPerson, ReportKind, ReportReason } from '@/api/safety';

const BLOCKS_KEY = ['my-blocks'];

// 출시 필수 (명세 4-24). 화면은 src/api를 직접 부르지 않으므로 여기서 묶는다
export function useSafety() {
  const queryClient = useQueryClient();
  const refreshAll = () => queryClient.invalidateQueries();

  return {
    report: useMutation({ mutationFn: (input: Parameters<typeof reportContent>[0]) => reportContent(input) }),
    block: useMutation({ mutationFn: (id: string) => blockUser(id), onSuccess: refreshAll }),
    unblock: useMutation({ mutationFn: (id: string) => unblockUser(id), onSuccess: refreshAll }),
    leave: useMutation({ mutationFn: (id: string) => leaveGroup(id), onSuccess: refreshAll }),
    rename: useMutation({
      mutationFn: ({ groupId, name }: { groupId: string; name: string }) => renameGroup(groupId, name),
      onSuccess: refreshAll,
    }),
    cancel: useMutation({ mutationFn: (id: string) => cancelSession(id), onSuccess: refreshAll }),
    setName: useMutation({ mutationFn: (name: string) => setMyName(name), onSuccess: refreshAll }),
    deleteAccount: useMutation({ mutationFn: () => deleteMyAccount(), onSuccess: () => queryClient.resetQueries() }),
  };
}

export function useMyBlocks(enabled: boolean) {
  return useQuery({ queryKey: BLOCKS_KEY, queryFn: () => listMyBlocks(), enabled });
}
