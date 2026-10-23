# Display cached status only in interactive SSH shells; never query the network.
case $- in
    *i*)
        if [ -n "${SSH_CONNECTION:-}" ] && [ -x /usr/local/sbin/authelia-update-check ]; then
            /usr/local/sbin/authelia-update-check --status || :
        fi
        ;;
esac
