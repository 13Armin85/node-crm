import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getApi } from "services/api";

const initialState = {
  images: [],
  status: "idle",
  error: null,
};

// Create an asynchronous thunk
export const fetchImage = createAsyncThunk(
  "images/fetchImage",
  async (active) => {
    try {
      const response = await getApi(`api/images/${active ? active : ""}`);
      if (response?.status !== 200 || !Array.isArray(response.data)) throw new Error("Failed to load images");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
);
const imageSlice = createSlice({
  name: "images",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchImage.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchImage.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.images = action.payload;
        state.error = null; // Reset error on successful fetch
      })
      .addCase(fetchImage.rejected, (state, action) => {
        state.status = "failed";
        state.images = [];
        state.error = action.error.message;
      });
  },
});

export default imageSlice.reducer;
