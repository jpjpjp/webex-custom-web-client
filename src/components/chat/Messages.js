import React from 'react';
import ChatBox from "./ChatBox";
import Message from "./Message";

class Messages extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      height: 0,
      messages: props.messages,
      lookingState: props.lookingState
    }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    return {
      messages: nextProps.messages,
      lookingState: nextProps.lookingState
    }
  }

  componentDidMount() {
    this.assignHeight();
    window.addEventListener("resize", this.assignHeight.bind(this));
  }

  assignHeight() {
    let chat_height = this.state.gif ? 200 : 35;
    let _docHeight = (document.height !== undefined) ? document.height : document.body.offsetHeight;
    this.setState({
      height: _docHeight - 65 - chat_height
    });
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.assignHeight.bind(this));
  }

  toggleAway(e) {
    if (this.state.lookingState === 'away') {
      this.props.isBack();
    } else {
      this.props.goneAway({
        type: 'goneAwayMarker',
        text: this.state.message
      });
    } 
  }

  render() {
    return (
      <div className="messages col-xs-12 col-sm-12 col-md-8 col-lg-10" style={{ height: this.state.height + 'px' }}>
        {this.state.lookingState != 'away' &&
         this.state.messages.length ? (
          this.state.messages.map((message, i) => {
            return (
              <Message key={i} message={message} />
            )
          })
        ) : (
          <div className="no-message">
            {this.state.lookingState != 'away' &&
              'No messages in chat room'
            }
          </div>
        )}
        <ChatBox
          sendMessage={this.props.sendMessage}
          goneAway={this.props.goneAway}
          isBack={this.props.isBack}
          toggleAway={this.toggleAway.bind(this)}
          lookingState={this.state.lookingState}
        />
      </div>
    )
  }
}

export default Messages;