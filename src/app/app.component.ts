import {Component} from '@angular/core';
import {createMachine, interpret, assign } from 'xstate';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'session-app';
  machine: any;
  hasSession: boolean = false;
  hasSessionRefreshRequest: boolean = false;
  currentSessionTime = 0;
  maxSessionTime = 5;
  timeToExpire = 5;
  tempCount = 5000;
  tempCountInterval: any;

  constructor() {
  }

  ngOnInit() {
    this.machine = interpret(createMachine(
      {
        id: 'timerSession',
        initial: 'checkIfIsLoggedIn',
        strict: true,
        context: {
          maxTimeout: 5000,
          sessionStartDateTime: 0,
        },
        states: {
          checkIfIsLoggedIn: {
            invoke: {
              src: 'doCheckLoggedInStatus',
              onDone: 'loggedIn',
              onError: 'loggedOut'
            }
          },
          authUser: {
            invoke: {
              src: 'doLogIn',
              onDone: 'loggedIn',
              onError: 'loggedOut'
            }
          },
          loggedIn: {
            id: 'loggedInMachine',
            initial: 'running',
            states: {
              stopped: {
                entry: ['resetSessionStartTime'],
                on: {
                  'always': '#timerSession.loggedOut',
                },
              },
              running: {
                entry: ['setSessionStartTime'],
                invoke: {
                  src: 'sessionChecker',
                },
                on: {
                  STOP_TIMER: 'stopped',
                  REFRESH_TIMER: 'running',
                  REQUEST_REFRESH: 'waitingRefresh',
                },
              },
              waitingRefresh: {
                entry: ['askForRefresh'],
                on: {
                  STOP_TIMER: 'stopped',
                  REFRESH_TIMER: 'running',
                },
                after: {
                  WAITING_ANSWER_TIMEOUT: 'stopped',
                },
              },
              exit: {
                type: 'final',
              },
            }
          },
          loggedOut: {
            entry: ['deleteUserData'],
            on: {
              REQUEST_LOGIN: 'authUser',
            }
          }
        },
      },
      {
        services: {
          // AUTH SERVICES
          doCheckLoggedInStatus: async () => {
            try {
              const isLogged = await Promise.reject('No tiene session');
            } catch (e) {
              console.error('error on Log', e);
              throw Error(); // propagar Excepción
            }
          },
          doLogIn: async () => {
            console.log('DO LOGIN');
            try {
              await Promise.resolve('Login a Firebase');
              this.hasSession = true;
            } catch (e) {
              console.error('error on Log', e);
              throw Error(); // propagar Excepción
            }
          },

          // TIMER SERVICES
          sessionChecker: (context, event) => (callback, onReceive) => {

            onReceive((event) => {
              console.log('Recibiendo evento desde parent');
              if (event.type === 'REFRESH_TIMER') {
                callback('REFRESH_TIMER');
              }
            });
            const checker = setInterval(() => {
              const diff =
                Math.floor(new Date().getTime() / 1000) -
                context.sessionStartDateTime;
              console.log('difference', diff);

              this.currentSessionTime += 1; // tiempo acitivo
              this.timeToExpire = this.maxSessionTime - diff;

              if (diff > this.maxSessionTime) {
                callback('REQUEST_REFRESH');
              }
            }, 1000);

            return () => {
              clearInterval(checker);
            };
          },
        },
        actions: {
          deleteUserData: () => {
            console.log('delete user Data');
            sessionStorage.removeItem('sessionStartDateTime');
          },
          askForRefresh: () => {
            this.askToContinue();
          },
          setSessionStartTime: assign((context, event) => {
            console.log('SESSION START / REFRESH TIME', event);

            const startDateTime = Math.floor(new Date().getTime() / 1000);
            sessionStorage.setItem('sessionStartDateTime', startDateTime.toString());
            this.timeToExpire = this.maxSessionTime;
            return {
              sessionStartDateTime: startDateTime
            };
          }),
          resetSessionStartTime: (context, event) => {
            console.log('SESSION RESET TIME', context, event);
            if(this.tempCountInterval) { clearInterval(this.tempCountInterval)}
            this.tempCount = 5000;
            this.timeToExpire = this.maxSessionTime;
            this.currentSessionTime = 0;
            this.hasSession = false;
            this.hasSessionRefreshRequest = false;
          }
        },
        delays: {
          WAITING_ANSWER_TIMEOUT: 5000,
        },
      }
    )).onTransition((event) => {
      console.warn('event', event.value);
    }).start();
  }

  doLogin() {
    console.log('DOING REAL LOGIN');
    setTimeout(() => {
      // request LOGIN TO BackEnd
      // this.machine.send('START_TIMER');
      this.machine.send('REQUEST_LOGIN');
    }, 1000);
  }

  doLogout() {
    console.log('haciendo LOGOUT');
    // request LOGOUT TO BackEnd
    this.hasSessionRefreshRequest = false;
    this.hasSession = false;
    this.machine.send('STOP_TIMER');
  }

  askToContinue() {
    this.tempCountInterval = setInterval(() => {
      this.tempCount -= 100;
    }, 100);
    this.hasSessionRefreshRequest = true;
  }

  doRefresh() {
    this.hasSessionRefreshRequest = false;
    this.machine.send('REFRESH_TIMER');
  }
}
