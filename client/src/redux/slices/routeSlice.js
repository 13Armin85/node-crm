import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getApi } from "services/api";

export const fetchRouteData = createAsyncThunk("fetchRouteData", async () => {
  try {
    const response = await getApi(`api/route/`);
    if (response?.status !== 200 || !Array.isArray(response.data)) throw new Error("Failed to load records");
    return response.data.filter(item => item && typeof item.moduleName === "string");
  } catch (error) {
    throw error;
  }
});

const routeSlice = createSlice({
  name: "routeData",
  initialState: {
    data: [],
    isLoading: false,
    error: "",
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRouteData.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchRouteData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
        state.error = "";
      })
      .addCase(fetchRouteData.rejected, (state, action) => {
        state.isLoading = false;
        state.data = [];
        state.error = action.error.message;
      });
  },
});

export default routeSlice.reducer;
