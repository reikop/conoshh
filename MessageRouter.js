import Discord from "discord.js";

export default class MessageRouter{

    router = {};

    registWorker(action, worker){
        if(Array.isArray(action)){
            action.forEach(a => {
                this.router[a] = worker;
            })
        }else{
            this.router[action] = worker;
        }
    }

    receiveMessage(msg) {
        if(msg.author.id === '366297167247310860'){
            
        }
        Object.keys(this.router).forEach(key => {
            if(msg.content.startsWith(key)){
                this.router[key].receiveMessage(msg);
            }else if(key === "*"){
                this.router[key].receiveMessage(msg);
            }
        })
    }

}