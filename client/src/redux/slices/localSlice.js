import { createSlice } from "@reduxjs/toolkit";
import { getStoredUser } from "services/authSession";

const initialState = {
  user: getStoredUser(),
};

const localSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      // You can also update localStorage here if needed
    },
    clearUser: (state) => {
      state.user = null;
    },
  },
});

export const { setUser, clearUser } = localSlice.actions;

export default localSlice.reducer;
