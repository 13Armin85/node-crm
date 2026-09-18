import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getApi } from "../../services/api";

export const fetchTaskData = createAsyncThunk("fetchTaskData", async () => {
  try {
    const response = await getApi("api/task");
    return response;
  } catch (error) {
    throw error;
  }
});

const taskSlice = createSlice({
  name: "taskData",
  initialState: {
    data: [],
    isLoading: false,
    error: "",
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTaskData.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchTaskData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
        state.error = "";
      })
      .addCase(fetchTaskData.rejected, (state, action) => {
        state.isLoading = false;
        state.data = [];
        state.error = action.error.message;
      });
  },
});

export default taskSlice.reducer;
