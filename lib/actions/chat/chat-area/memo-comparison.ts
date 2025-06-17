export interface ChatAreaProps {
  initialThreadId?: string | null;
}

// Custom comparison function for React.memo to prevent unnecessary re-renders
export function chatAreaMemoComparison(
  prevProps: Readonly<ChatAreaProps>,
  nextProps: Readonly<ChatAreaProps>,
): boolean {
  // Custom comparison function for memo to prevent unnecessary re-renders
  const propsEqual = prevProps.initialThreadId === nextProps.initialThreadId;

  return propsEqual;
}
