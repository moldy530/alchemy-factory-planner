import { createContext, useContext } from "react";

export const ConnectionEditingContext = createContext(false);
export const useConnectionEditing = () => useContext(ConnectionEditingContext);
