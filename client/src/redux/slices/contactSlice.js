import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getApi } from "services/api";

export const fetchContactData = createAsyncThunk(
  "fetchContactData",
  async () => {
    try {
      const response = await getApi('api/contact/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
);

const getContactSlice = createSlice({
  name: "contactData",
  initialState: {
    data: [],
    isLoading: false,
    error: "",
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContactData.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchContactData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
        state.error = "";
      })
      .addCase(fetchContactData.rejected, (state, action) => {
        state.isLoading = false;
        state.data = [];
        state.error = action.error.message;
      });
  },
});

export default getContactSlice.reducer;
