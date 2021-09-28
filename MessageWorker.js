import axios from "axios";

export default class MessageWorker {

    constructor() {
        this._api = axios.create({
            // baseURL : 'https://api-aion.plaync.com',
        });
    }

    receiveMessage(msg){}

    get api(){
        return this._api;
    }
}