import axios from 'axios';

const url = import.meta.env.VITE_API_URL;

const api = axios.create({
    baseURL: url,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    },
});

export interface ResponseBody {
    success: boolean,
    data: any
}

export const getRequest = async (endpoint: string, params = {}): Promise<ResponseBody> => {
    try {
        const response = await api.get(`api/${endpoint}`, { params, withCredentials: true });
        return {success: true, data: response.data};
    } catch (error) {
        return handleError(error);
    }
};

export const postRequest = async (endpoint: string, data: any): Promise<ResponseBody> => {
    try {
        const headers = data instanceof Blob || data instanceof File
            ? { 'Content-Type': data.type || 'application/octet-stream' } // Use Blob/File's type
            : { 'Content-Type': 'application/json' }; // Default to JSON

        const response = await api.post(`api/${endpoint}`, data, {
            headers: headers,
        });

        return {success: true, data: response.data};
    } catch (error) {
        return handleError(error);
    }
};

const handleError = (error: any) => {
    if (error.response) {
        const { data } = error.response;
        return { success: false, data: data?.message || 'An error occurred' };
    } else if (error.request) {
        return { success: false, data: 'No response from server' };
    } else {
        return { success: false, data: error.message || 'Something went wrong' };
    }
};


export default api;